
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { transcribeAudio, generateResponse, readPdf, analyzeImage } from './aiService';
import { fileURLToPath } from 'url';

import OpenAI from 'openai';

// Load .env explicitly from absolute path
dotenv.config({ path: '/root/mudashape-scheduler/.env' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// -- ESM __dirname fix --
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -- Config --
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Use Service Role Key for backend to bypass RLS if needed, or Anon if policies allow
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const EVO_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVO_API_KEY = process.env.VITE_EVOLUTION_API_KEY;
// Instance for Outbound Scheduler/Notifications
const EVO_INSTANCE = process.env.VITE_EVOLUTION_INSTANCE || 'default';
// Instance for AI Interactions (inbound/outbound)
const EVO_AI_INSTANCE = process.env.VITE_EVOLUTION_AI_INSTANCE || 'Tulio';

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

    // Clean phone number: remove non-digits
    let cleanPhone = phone.replace(/\D/g, '');

    // If it's a Brazilian number (10 or 11 digits) without country code, add 55
    if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
    }

    console.log(`[WA] Attempting send to ${cleanPhone} via ${EVO_AI_INSTANCE} at ${EVO_API_URL}...`);

    try {
        const response = await axios.post(`${EVO_API_URL}/message/sendText/${EVO_AI_INSTANCE}`, {
            number: cleanPhone,
            text: text,
            options: { delay: 1000, presence: 'composing' }
        }, {
            headers: { apikey: EVO_API_KEY },
            timeout: 10000 // 10s timeout
        });
        console.log(`[WA] Sent to ${cleanPhone} - OK (Status: ${response.status})`);
    } catch (e: any) {
        console.error('[WA] Error sending:', e.response?.data || e.message);
    }
};

const getBase64FromUrl = async (url: string): Promise<{ base64: string, mimeType: string }> => {
    // Evolution API media endpoints often require authentication
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'apikey': EVO_API_KEY }
    });
    const buffer = Buffer.from(response.data, 'binary');

    // Magic Bytes Detection
    let mimeType = 'image/jpeg'; // Default
    const header = buffer.toString('hex', 0, 4);

    if (header.startsWith('89504e47')) {
        mimeType = 'image/png';
    } else if (header.startsWith('ffd8')) {
        mimeType = 'image/jpeg';
    } else if (header.startsWith('47494638')) {
        mimeType = 'image/gif';
    } else if (header.startsWith('52494646') && buffer.toString('hex', 8, 12) === '57454250') {
        // RIFF....WEBP
        mimeType = 'image/webp';
    } else {
        // Fallback to header or default if detection fails, but prioritize detection
        console.log(`[Vision] Magic detection failed for header: ${header}, falling back to header/default`);
        const headerMime = response.headers['content-type'];
        if (headerMime && !headerMime.includes('octet-stream')) {
            mimeType = headerMime.split(';')[0].trim();
        }
    }

    console.log(`[Vision] Detected MIME (Magic): ${mimeType}`);
    const base64 = buffer.toString('base64');
    return { base64, mimeType };
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

// NOVA FUNÇÃO: Pede o Base64 Descriptografado para o Evolution
const fetchMediaBase64 = async (messageId: string): Promise<{ base64: string, mimeType: string } | null> => {
    try {
        console.log(`[Vision] Fetching base64 directly from API for message: ${messageId}`);
        // Endpoint V2 para buscar media descriptografada
        const response = await axios.post(`${EVO_API_URL}/chat/getBase64FromMediaMessage/${EVO_AI_INSTANCE}`, {
            message: {
                key: {
                    id: messageId
                }
            },
            convertToMp4: false
        }, {
            headers: { apikey: EVO_API_KEY }
        });

        if (response.data && response.data.base64) {
            const base64 = response.data.base64;
            const mimeType = response.data.mimetype || 'image/jpeg';
            // O Evolution as vezes manda "data:image/jpeg;base64,.....", precisamos limpar
            return { base64: base64.replace(/^data:.*,/, ''), mimeType };
        }
        return null;
    } catch (e: any) {
        console.error('[Vision] Failed to fetch base64 from API (Error):', e.response?.data || e.message);
        return null;
    }
};

// NOVA FUNÇÃO: Busca alimentos (HÍBRIDA com Extração por IA)
const searchFood = async (query: string) => {
    if (!query || query.length < 3 || query.startsWith('!')) return [];

    try {
        // 1. Usar IA para extrair nomes de alimentos da mensagem
        const extraction = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    role: "system",
                    content: "Você é um extrator de nomes de alimentos. O usuário vai enviar uma mensagem e você deve responder APENAS com os nomes dos alimentos mencionados, separados por vírgula. Se não houver nenhum alimento, responda exatamente: NONE. Exemplos:\n- 'quantas calorias tem o queijo muçarela light' → 'queijo muçarela light'\n- 'comi arroz, feijão e frango' → 'arroz, feijão, frango'\n- 'bom dia, tudo bem?' → 'NONE'\n- 'quero emagrecer' → 'NONE'"
                },
                { role: "user", content: query }
            ],
            max_tokens: 100,
            temperature: 0,
        });

        const extractedFoods = extraction.choices[0].message.content?.trim() || 'NONE';
        console.log(`[TBCA] AI Extracted Foods: "${extractedFoods}"`);

        // Se a IA não encontrou alimentos, pular busca
        if (extractedFoods === 'NONE' || extractedFoods.length < 2) {
            console.log('[TBCA] No food detected in message. Skipping search.');
            return [];
        }

        const uniqueResults = new Map<string, any>();

        // 2. Vector Search (Semantic) + Text Search em paralelo
        const embeddingPromise = (async () => {
            const embeddingInput = extractedFoods.replace(/\n/g, ' ').trim();
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: embeddingInput,
                encoding_format: "float",
            });
            const embedding = embeddingResponse.data[0].embedding;



            // === PARALLEL SOURCE SEARCH ===
            // Search TACO and TBCA independently to guarantee results from both
            const [tacoResult, tbcaResult] = await Promise.all([
                supabase.rpc('match_foods_by_source', {
                    query_embedding: embedding,
                    match_threshold: 0.3,
                    match_count: 10,
                    food_source: 'TACO'
                }),
                supabase.rpc('match_foods_by_source', {
                    query_embedding: embedding,
                    match_threshold: 0.3,
                    match_count: 20, // Fetch more to filter noise
                    food_source: 'TBCA'
                })
            ]);

            if (tacoResult.error) console.error('[TACO] Vector Error:', tacoResult.error);
            if (tbcaResult.error) console.error('[TBCA] Vector Error:', tbcaResult.error);

            const tacoItems = tacoResult.data || [];
            const tbcaRaw = tbcaResult.data || [];

            // Filter TBCA noise (papas, sopas, infantis)
            const tbcaClean = tbcaRaw.filter((i: any) => {
                const name = i.name.toLowerCase();
                return !name.startsWith('papa de') &&
                    !name.includes('infantil') &&
                    !name.includes('sopa de') &&
                    !name.includes('purê de');
            }).slice(0, 10);

            const finalVectorResults = [...tacoItems, ...tbcaClean];
            console.log(`[Search] Vector: ${tacoItems.length} TACO + ${tbcaClean.length} TBCA (filtered from ${tbcaRaw.length})`);

            return finalVectorResults;
        })();

        // Text Search usando os termos extraídos pela IA
        const textSearchPromise = supabase
            .from('foods')
            .select('id, name, calories, protein, carbs, fat, unit')
            .textSearch('name', extractedFoods, { config: 'portuguese', type: 'websearch' })
            .limit(3);

        const [vectorResults, { data: textResults, error: textError }] = await Promise.all([
            embeddingPromise.catch(e => { console.error('Vector Error:', e); return []; }),
            textSearchPromise
        ]);

        if (textError) console.error('Text Search Error:', textError);

        // 3. Merge Results (Text first for specificity, then Vector)
        textResults?.forEach((item: any) => uniqueResults.set(item.id, { ...item, source: 'text' }));
        vectorResults?.forEach((item: any) => {
            if (!uniqueResults.has(item.id)) {
                uniqueResults.set(item.id, { ...item, source: 'vector' });
            }
        });

        const finalResults = Array.from(uniqueResults.values());

        if (finalResults.length > 0) {
            console.log(`[TBCA] Results for "${extractedFoods}":`);
            finalResults.forEach((item: any) => {
                console.log(`   🔸 [${item.source.toUpperCase()}] ${item.name} (${item.calories} kcal)`);
            });
        } else {
            console.log(`[TBCA] No results found for "${extractedFoods}".`);
        }

        return finalResults;

    } catch (e: any) {
        console.error('[TBCA] Search failed:', e.message);
        return [];
    }
};

// NOVA FUNÇÃO: Classifica intenção (Search Food vs Chat)
const shouldSearchFood = async (userMessage: string, history: any[]): Promise<boolean> => {
    try {
        // Simple heuristic for very short messages to save AI calls
        if (userMessage.length < 3) return false;

        const systemPrompt = `Analyze the user's message and history. Determine if they are asking about food nutrition, calories, diet, or macros.
        Examples:
        - "Quantas calorias tem a banana?" -> YES
        - "E a maçã?" (Context: food) -> YES
        - "Como ganhar massa?" -> YES (needs food context)
        - "Bom dia" -> NO
        - "Treino de peito" -> NO
        
        Respond ONLY with "YES" or "NO".`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-3), // Look at last 3 messages for context
            { role: 'user', content: userMessage }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast & cheap
            messages: messages as any,
            max_tokens: 5,
            temperature: 0,
        });

        const answer = response.choices[0].message.content?.trim().toUpperCase();
        console.log(`[AI Trigger] Should Search Food? "${userMessage}" -> ${answer}`);
        return answer === 'YES';

    } catch (e) {
        console.error('[AI Trigger] Error:', e);
        return false;
    }
};

// -- Routes --

app.get('/health', (req, res) => {
    res.send('AI Server OK');
});

// Webhook for Evolution API
app.post('/webhook/evolution', async (req, res) => {
    try {
        const body = req.body;
        console.log(`[Webhook DEBUG] Raw Payload Received:`, JSON.stringify(body, null, 2));
        console.log(`[Webhook] Event Received: ${body.event}`);

        if (body.event !== 'MESSAGES_UPSERT' && body.event !== 'messages.upsert') {
            return res.status(200).send('Event ignored');
        }

        // Check your Evolution version documentation. Assuming generic structure used in n8n.
        // Also handle if data is array (MESSAGES_UPSERT)
        const data = Array.isArray(body.data) ? body.data[0] : body.data;
        if (!data) return res.status(200).send('No data');

        // Optional: Filter by instance if Evolution sends it in payload
        // const instance = body.instance;
        // if (instance && instance !== EVO_AI_INSTANCE) return res.status(200).send('Wrong instance');

        let senderId = data.key?.remoteJid || ''; // e.g. 551199999999@s.whatsapp.net
        const remoteJidAlt = data.key?.remoteJidAlt;

        // Fix: If simple ID is LID, try to use the alternate JID which usually has the phone number
        if (senderId.includes('@lid') && remoteJidAlt) {
            console.log(`[Webhook] LID detected (${senderId}), using Alt: ${remoteJidAlt}`);
            senderId = remoteJidAlt;
        }

        const fromMe = data.key?.fromMe;

        if (fromMe) return res.status(200).send('Ignored (from me)');
        if (!senderId) return res.status(200).send('No sender');

        const phone = senderId.split('@')[0];
        // Clean incoming phone: remove generic 55 prefix if present to normalize
        const cleanIncoming = phone.replace(/^55/, '').replace(/\D/g, '');
        console.log(`[Webhook] Processing phone: ${phone} (Clean: ${cleanIncoming})`);

        // 1. Check if Client exists and AI is enabled
        console.log('[Webhook] Fetching all clients from Supabase...');
        const { data: allClients, error: clientsError } = await supabase
            .from('clients')
            .select('*');

        if (clientsError) {
            console.error('[Webhook] Supabase Fetch Error:', clientsError);
            return res.status(500).send('DB Error');
        }
        console.log(`[Webhook] Fetched ${allClients?.length || 0} clients.`);

        const client = allClients?.find(c => {
            if (!c.phone) return false;
            const dbPhone = c.phone.replace(/\D/g, '').replace(/^55/, '');

            // Check exact match OR match without 9th digit
            if (dbPhone === cleanIncoming) return true;

            if (cleanIncoming.length === 10 && dbPhone.length === 11) {
                const dbNoNine = dbPhone.substring(0, 2) + dbPhone.substring(3);
                if (dbNoNine === cleanIncoming) return true;
            }

            if (cleanIncoming.length === 11 && dbPhone.length === 10) {
                const incNoNine = cleanIncoming.substring(0, 2) + cleanIncoming.substring(3);
                if (incNoNine === dbPhone) return true;
            }

            return false;
        });

        if (!client) {
            console.log(`[Webhook] Sender ${phone} (Clean: ${cleanIncoming}) not found in clients.`);

            // ALERT: Notify Admin (Gabriel) about unknown number
            // await sendMessage('5538998859375', `⚠️ *Alerta IA (Desconhecido)*\n\nRecebi uma mensagem de um número não cadastrado:\nID: ${senderId}\nLimpo: ${cleanIncoming}\n\nVerifique se o aluno está na plataforma.`);

            return res.status(200).send('Client not found');
        }

        if (!client.ai_enabled) {
            console.log(`[Webhook] AI disabled for ${client.name}.`);
            return res.status(200).send('AI disabled');
        }

        console.log(`[Webhook] Message from ${client.name} (${client.ai_mode})`);
        console.log('[Debug] Full Payload Data:', JSON.stringify(data, null, 2));

        // 2. Identify Message Type
        const messageType = data.messageType;
        const messageContent = data.message;
        console.log(`[Debug] Message Type: ${messageType}`);

        let userContent = "";

        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            userContent = messageContent?.conversation || messageContent?.extendedTextMessage?.text || "";
            if (!userContent && data.message?.message?.conversation) {
                userContent = data.message.message.conversation;
            }
        }
        console.log(`[Debug] Extracted Content: "${userContent}"`);

        // --- COMMAND: RESET HISTORY ---
        if (userContent && ['!reiniciar', '!limpar', '!reset'].includes(userContent.trim().toLowerCase())) {
            console.log(`[Command] Reset history for ${client.name}`);

            await supabase.from('ai_messages').delete().eq('client_id', client.id);

            await sendMessage(phone, "✅ *Histórico reiniciado!*\n\nA partir de agora, não lembrarei de nossas conversas anteriores. Como posso te ajudar hoje?");

            return res.status(200).send('History reset');
        }
        else if (messageType === 'audioMessage') {
            console.log('[Webhook] Audio received. Handling...');

            let audioBase64 = null;

            // 1. Tentar fetch da API Evolution (Garanti descripitografia)
            if (data.key?.id) {
                const fetched = await fetchMediaBase64(data.key.id);
                if (fetched && fetched.base64) {
                    audioBase64 = fetched.base64;
                    console.log('[Vision] Fetched audio base64 from API');
                }
            }

            if (audioBase64) {
                const tempFilePath = path.join(__dirname, `../uploads/audio_${data.key.id}.mp3`);

                try {
                    fs.writeFileSync(tempFilePath, Buffer.from(audioBase64, 'base64'));
                    const transcription = await transcribeAudio(tempFilePath);
                    console.log(`[AI] Transcription: ${transcription}`);

                    userContent = `[Áudio do usuário]: "${transcription}"`;

                    // Optional: Clean up file
                    fs.unlinkSync(tempFilePath);
                } catch (e) {
                    console.error('[AI] Audio processing error:', e);
                    userContent = "[Áudio recebido, mas falha na transcrição]";
                }
            } else {
                userContent = "[Áudio recebido, mas falha no download. Tente texto.]";
            }
        }
        else if (messageType === 'imageMessage') {
            console.log('[Webhook] Image received. Analyzing...');

            let base64 = "";
            let mimeType = "image/jpeg"; // Default fallback

            // Evolution V2: Check if mediaUrl exists or base64 is provided
            const mediaUrl = data.mediaUrl || data.message?.imageMessage?.url;
            console.log('[Vision] Media URL:', mediaUrl);

            // 1. Tentar base64 direto do payload (configuração do webhook)
            if (data.base64) {
                base64 = data.base64;
                console.log('[Vision] Using base64 from payload');
            }

            // 2. Tentar fetch da API Evolution (MÉTODO PREFERIDO para garantir descriptografia)
            else if (data.key?.id) {
                const fetched = await fetchMediaBase64(data.key.id);
                if (fetched) {
                    base64 = fetched.base64;
                    mimeType = fetched.mimeType;
                    console.log('[Vision] Fetched clean base64 from API');
                }
            }

            // 3. Fallback: Download da URL
            if (!base64 && mediaUrl) {
                try {
                    const result = await getBase64FromUrl(mediaUrl);
                    base64 = result.base64;
                    mimeType = result.mimeType;
                } catch (e) {
                    console.error('[Vision] Failed to download image from URL:', e);
                }
            }

            if (base64) {
                const analysis = await analyzeImage(base64, "Analise esta imagem focando em alimentos. Identifique o que é e faça uma estimativa das calorias totais presentes, trazendo a quantidade em gramas/litros/outro e as calorias.", mimeType);
                userContent = `[Imagem enviada pelo usuário]. Análise da IA: ${analysis}`;
                console.log('[Vision] Analysis:', analysis);
            } else {
                userContent = "[Imagem enviada, mas não consegui visualizar. Peça para o usuário descrever]";
            }
        }

        if (!userContent) return res.status(200).send('Empty content');

        // 3. Build Context & Send to OpenAI (Updated with Dynamic Config)
        console.log('[Debug] Fetching AI Config...');

        // Fetch Global Config
        let configPrompt = "Você é um assistente pessoal de fitness. Seja breve e direto.";
        let configFaq = [];

        try {
            const { data: configData, error: configError } = await supabase.from('ai_config').select('*').limit(1).single();
            if (configError) console.error('[Debug] Supabase Config Error:', configError);
            if (configData) {
                configPrompt = configData.system_prompt || configPrompt;
                configFaq = configData.faq || [];
            }
        } catch (e) {
            console.error('[AI] Error fetching config:', e);
        }

        console.log('[Debug] Saving user message to history...');

        // Save user message
        const { error: insertError } = await supabase.from('ai_messages').insert({
            client_id: client.id, role: 'user', content: userContent
        });
        if (insertError) console.error('[Debug] Supabase Insert Error:', insertError);

        console.log('[Debug] Fetching message history...');

        // Get History (last 10)
        const { data: history, error: historyError } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(10);

        if (historyError) console.error('[Debug] Supabase History Error:', historyError);

        const validHistory = history?.reverse().map(h => ({ role: h.role as any, content: h.content })) || [];

        // Build Final Prompt
        let faqText = "";
        if (configFaq.length > 0) {
            faqText = "\n\nBASE DE CONHECIMENTO (FAQ) - Use estas propostas se a pergunta for relevante:\n";
            configFaq.forEach((f: any) => {
                faqText += `P: ${f.question}\nR: ${f.answer}\n---\n`;
            });
        }

        // NOVA FUNÇÃO: Classifica intenção (Search Food vs Chat)
        const shouldSearchFood = async (userMessage: string, history: any[]): Promise<boolean> => {
            try {
                // Simple heuristic for very short messages to save AI calls
                if (userMessage.length < 3) return false;

                const systemPrompt = `Analyze the user's message and history. Determine if they are asking about food nutrition, calories, diet, or macros.
        Examples:
        - "Quantas calorias tem a banana?" -> YES
        - "E a maçã?" (Context: food) -> YES
        - "Como ganhar massa?" -> YES (needs food context)
        - "Bom dia" -> NO
        - "Treino de peito" -> NO
        
        Respond ONLY with "YES" or "NO".`;

                const messages = [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-3), // Look at last 3 messages for context
                    { role: 'user', content: userMessage }
                ];

                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Fast & Cheap
                    messages: messages as any,
                    max_tokens: 5,
                    temperature: 0,
                });

                const answer = response.choices[0].message.content?.trim().toUpperCase();
                console.log(`[AI Trigger] Should Search Food? "${userMessage}" -> ${answer}`);
                return answer === 'YES';

            } catch (e) {
                console.error('[AI Trigger] Error:', e);
                return false; // Fallback to safe "NO" or keyword list
            }
        };



        // --- FOOD SEARCH (TBCA/TACO) ---
        let foodContext = "";

        // AI Decision to Search
        const searchNeeded = await shouldSearchFood(userContent, validHistory);

        if (searchNeeded) {
            const foodResults = await searchFood(userContent);
            if (foodResults.length > 0) {
                foodContext = `\n\n[TABELA TACO/TBCA - DADOS REAIS]\nO usuário pode estar perguntando sobre estes alimentos. Use estes dados EXATOS se for relevante:\n`;
                foodResults.forEach(f => {
                    foodContext += `- ${f.name}: ${f.calories}kcal, P:${f.protein}g, C:${f.carbs}g, G:${f.fat}g (por ${f.unit})\n`;
                });
                console.log(`[TBCA] Found ${foodResults.length} foods for context.`);
            }
        }

        const finalSystemPrompt = `${configPrompt}
        
        ${faqText}

        ${foodContext}
        
        CAPACIDADES MULTIMODAIS:
        1. IMAGEM: Você CONSEGUE ver fotos. Quando o usuário mandar uma foto, você receberá a descrição da IA no formato "[Imagem enviada... Análise: ...]". Use essa descrição para responder como se estivesse vendo.
        2. ÁUDIO: Você CONSEGUE ouvir áudios. Quando o usuário mandar um áudio, você receberá a transcrição no formato "[Áudio do usuário]: ...". Responda naturalmente ao que foi falado.
        
        IMPORTANTE: NUNCA diga que não consegue ver imagens ou ouvir áudios.
        Cliente: ${client.name}`;

        console.log('[Debug] Sending to OpenAI (GPT-4.1)...');
        console.log('[Debug] History length:', validHistory.length);

        const reply = await generateResponse(validHistory, finalSystemPrompt);

        console.log('[Debug] AI Response received:', reply.substring(0, 50) + '...');

        // 4. Send Reply
        console.log(`[Debug] Sending reply to ${client.phone} via Evolution API...`);
        await sendMessage(client.phone, reply);

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
