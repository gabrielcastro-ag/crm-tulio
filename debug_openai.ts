
import 'dotenv/config';
import { generateResponse } from './services/aiService';

const run = async () => {
    console.log('Testing OpenAI connection...');
    try {
        const response = await generateResponse([], 'You are a helpful assistant. Respond with "Hello".');
        console.log('Response:', response);
    } catch (e) {
        console.error('CRASH DETECTED:', e);
    }
};

run();
