import dotenv from 'dotenv';
dotenv.config({ path: '/root/mudashape-scheduler/.env' });
import { File } from 'node:buffer';

// Polyfills for pdf-parse compatibility in Node 18
if (typeof (global as any).DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class { };
}
if (typeof (global as any).ImageData === 'undefined') {
    (global as any).ImageData = class { };
}
if (typeof (global as any).Path2D === 'undefined') {
    (global as any).Path2D = class { };
}
// Polyfill for OpenAI File upload (Node 18)
if (typeof (global as any).File === 'undefined') {
    (global as any).File = File;
}

import OpenAI from 'openai';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfWithErrors = require('pdf-parse');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

// Types
interface AiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | any[];
}

export const transcribeAudio = async (audioPath: string): Promise<string> => {
    try {
        console.log(`[AI] Transcribing audio: ${audioPath}`);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-1",
        });
        return transcription.text;
    } catch (error) {
        console.error('[AI] Transcription error:', error);
        throw error;
    }
};

export const analyzeImage = async (base64Image: string, prompt: string = "O que tem nesta imagem?", mimeType: string = "image/jpeg"): Promise<string> => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:${mimeType};base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
        });
        return response.choices[0].message.content || "";
    } catch (error) {
        console.error('[AI] Vision error:', error);
        throw error;
    }
};

export const readPdf = async (pdfBuffer: Buffer): Promise<string> => {
    try {
        const data = await pdfWithErrors(pdfBuffer);
        return data.text;
    } catch (error) {
        console.error('[AI] PDF reading error:', error);
        throw error;
    }
};

export const generateResponse = async (
    history: AiMessage[],
    systemPrompt: string
): Promise<string> => {
    try {
        // Ensure system prompt is first
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: messages as any,
        });

        return response.choices[0].message.content || "";
    } catch (error) {
        console.error('[AI] Generation error:', error);
        throw error;
    }
};
