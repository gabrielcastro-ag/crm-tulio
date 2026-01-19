
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { transcribeAudio, generateResponse, readPdf, analyzeImage } from './aiService';

// -- Config --
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use Service Role Key for backend to bypass RLS if needed, or Anon if policies allow
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EVO_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVO_API_KEY = process.env.VITE_EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.VITE_EVOLUTION_INSTANCE || 'default';

// -- Setup --
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase Config');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// -- Helpers --
const sendMessage = async (phone: string, text: string) => {
    if (!EVO_API_URL || !EVO_API_KEY) return console.log('[Mock Send]', phone, text);

    try {
        // Clean phone number (Evolution expects just digits, usually with country code)
        // Our DB has formatted phones, we might need to strip + or chars
        const cleanPhone = phone.replace(/\D/g, '');

        await axios.post(`${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`, {
            number: cleanPhone,
            text: text,
            options: { delay: 1000, presence: 'composing' }
        }, {
            headers: { apikey: EVO_API_KEY }
        });
        console.log(`[WA] Sent to ${cleanPhone}`);
    } catch (e) {
        console.error('[WA] Error sending:', e);
    }
};

const getBase64FromUrl = async (url: string): Promise<string> => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
};

const downloadFile = async (url: string, destPath: string) => {
    const writer = fs.createWriteStream(destPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
    });
};

// -- Routes --

app.get('/health', (req, res) => {
    res.send('AI Server OK');
});

// Webhook for Evolution API
app.post('/webhook/evolution', async (req, res) => {
    try {
        const body = req.body;
        // Evolution API V2 structure usually: data.key.remoteJid, data.message...
        // Check your Evolution version documentation. Assuming generic structure used in n8n.

        const data = body.data;
        if (!data) return res.status(200).send('No data');

        const senderId = data.key?.remoteJid || ''; // e.g. 551199999999@s.whatsapp.net
        const fromMe = data.key?.fromMe;

        if (fromMe) return res.status(200).send('Ignored (from me)');
        if (!senderId) return res.status(200).send('No sender');

        const phone = senderId.split('@')[0];

        // 1. Check if Client exists and AI is enabled
        // We match by phone. Our DB format might verify '1199999999' or '5511...'
        // Let's try to match relaxed (contains)
        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .ilike('phone', `%${phone.slice(-8)}%`) // Last 8 digits match to be safe
            .single();

        if (!client) {
            console.log(`[Webhook] Sender ${phone} not found in clients.`);
            return res.status(200).send('Client not found');
        }

        if (!client.ai_enabled) {
            console.log(`[Webhook] AI disabled for ${client.name}.`);
            return res.status(200).send('AI disabled');
        }

        console.log(`[Webhook] Message from ${client.name} (${client.ai_mode})`);

        // 2. Identify Message Type
        const messageType = data.messageType;
        const messageContent = data.message;

        let userContent = "";

        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            userContent = messageContent?.conversation || messageContent?.extendedTextMessage?.text || "";
        }
        else if (messageType === 'audioMessage') {
            // Evolution usually provides mediaUrl in the payload if 'downloadMedia' is configured or we fetch it.
            // If payload has base64, save it. If url, download.
            // Assuming we need to fetch media or it's in data.mediaUrl ?? 
            // Note: Evolution has a 'trace' or 'message' object. 
            // Simplified: Check if we have a URL or Base64.
            console.log('[Webhook] Audio received. Handling...');
            // TODO: Robust media handling depends on standard evolution behavior (webhook base64 or url)
            // Fallback: Ask user to text if audio fails.
            userContent = "[Audio Message] (Transkripção pendente - Implementar lógica de fetch media Evolution)";

            // If Evolution sends URL:
            /* 
            if (data.mediaUrl) {
                const filePath = `uploads/${Date.now()}.mp3`;
                await downloadFile(data.mediaUrl, filePath);
                userContent = await transcribeAudio(filePath);
                fs.unlinkSync(filePath);
            }
            */
        }
        else if (messageType === 'imageMessage') {
            userContent = "[Image Message]";
            // Similar to Audio, need to get the image Base64 or URL
        }

        if (!userContent) return res.status(200).send('Empty content');

        // 3. Build Context & Send to OpenAI
        // Save user message
        await supabase.from('ai_messages').insert({
            client_id: client.id, role: 'user', content: userContent
        });

        // Get History (last 10)
        const { data: history } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(10);

        const validHistory = history?.reverse().map(h => ({ role: h.role as any, content: h.content })) || [];

        // System Prompt
        const systemPrompt = `Você é um assistente pessoal de fitness para o aluno ${client.name}.
        Modo: ${client.ai_mode || 'standard'}.
        Objetivo: Ajudar com dúvidas sobre treino, dieta e motivação.
        Seja breve e direto. Use emojis.`;

        const reply = await generateResponse(validHistory, systemPrompt);

        // 4. Send Reply
        await sendMessage(phone, reply);

        // Save assistant message
        await supabase.from('ai_messages').insert({
            client_id: client.id, role: 'assistant', content: reply
        });

        res.status(200).send('Processed');

    } catch (err) {
        console.error('[Webhook] Error:', err);
        res.status(500).send('Error');
    }
});

app.listen(PORT, () => {
    console.log(`AI Server running on port ${PORT}`);
});
