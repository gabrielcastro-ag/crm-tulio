
import 'dotenv/config'; // Loads .env file
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY; // Or SERVICE_ROLE_KEY if you want to bypass RLS
const EVO_API_URL = process.env.VITE_EVOLUTION_API_URL;
const EVO_API_KEY = process.env.VITE_EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.VITE_EVOLUTION_INSTANCE;

if (!SUPABASE_URL || !SUPABASE_KEY || !EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE) {
    console.error('Missing environment variables. Check .env file.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🚀 Scheduler Service Started');
console.log(`Checking for pending messages every 60 seconds...`);

const checkAndSend = async () => {
    try {
        const now = new Date().toISOString();

        // 1. Fetch pending schedules that are due
        const { data: schedules, error } = await supabase
            .from('schedules')
            .select(`
                *,
                clients (
                    name,
                    phone
                )
            `)
            .eq('status', 'pending')
            .lte('date', now); // Less than or equal to now

        if (error) throw error;

        if (schedules && schedules.length > 0) {
            console.log(`Found ${schedules.length} pending items.`);

            for (const item of schedules) {
                await processItem(item);
            }
        } else {
            // console.log('No pending items.');
        }

    } catch (err) {
        console.error('Error in scheduler loop:', err);
    }
};

const processItem = async (item: any) => {
    const client = item.clients;
    if (!client || !client.phone) {
        console.error(`Client not found or no phone for schedule ${item.id}`);
        // Mark as failed or ignore?
        return;
    }

    console.log(`Processing item ${item.id} for ${client.name} (${client.phone})`);

    try {
        // Send via Evolution API
        const success = await sendEvolutionMessage(client.phone, item.message, item.attachment_url);

        if (success) {
            // Update status to sent
            const { error } = await supabase
                .from('schedules')
                .update({ status: 'sent' })
                .eq('id', item.id);

            if (error) console.error(`Failed to update status for ${item.id}`, error);
            else console.log(`✅ Item ${item.id} marked as SENT.`);
        } else {
            console.error(`❌ Failed to send item ${item.id}`);
        }

    } catch (err) {
        console.error(`Error processing item ${item.id}`, err);
    }
};

const sendEvolutionMessage = async (phone: string, text: string, attachmentUrl?: string) => {
    try {
        const cleanPhone = phone.replace(/\D/g, '');
        const number = `55${cleanPhone}`; // Assuming BR format, adjust if needed

        let url = '';
        let body: any = {};

        if (attachmentUrl) {
            // Send Media
            url = `${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`;
            body = {
                number: number,
                mediatype: "document",
                mimetype: "application/pdf",
                caption: text || "",
                media: attachmentUrl,
                fileName: "document.pdf"
            };
        } else {
            // Send Text
            url = `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`;
            body = {
                number: number,
                text: text
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVO_API_KEY as string
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Evolution API Error: ${response.status} - ${errText}`);
            return false;
        }

        const data = await response.json();
        // console.log('API Response:', data);
        return true;

    } catch (err) {
        console.error('Network error sending message:', err);
        return false;
    }
};

// Start Loop
checkAndSend(); // Run immediately on start
setInterval(checkAndSend, 60 * 1000); // And then every 60s
