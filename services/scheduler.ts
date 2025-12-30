
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
checkRenewals();
checkFeedbackAutomation(); // Run automation check on start

setInterval(() => {
    checkAndSend();
    checkRenewals();
    checkFeedbackAutomation();
}, 60 * 1000);

// ... (existing checkRenewals function) ...

// --- New Function: Check for Feedback Automation ---
// --- New Function: Check for Feedback Automation ---
async function checkFeedbackAutomation() {
    try {
        const now = new Date().toISOString();

        // 1. Fetch active schedules due to run
        const { data: schedules, error } = await supabase
            .from('feedback_schedules')
            .select('*')
            .eq('active', true)
            .lte('next_run_at', now);

        if (error) throw error;

        if (schedules && schedules.length > 0) {
            console.log(`Found ${schedules.length} automation rules to run.`);

            for (const schedule of schedules) {
                console.log(`Running Schedule: ${schedule.name} (Service: ${schedule.service_type}, Client: ${schedule.client_id})`);

                // Use questions from the schedule (custom) or fallback to empty array
                // If schedule.questions is empty/null, we might want to fetch default global questions? 
                // For V2, we assume they saved the questions into the schedule.
                let questionsToSend = schedule.questions;

                // Fallback for migrated rules that might have empty questions: fetch global
                if (!questionsToSend || questionsToSend.length === 0) {
                    const { data: globalQ } = await supabase
                        .from('feedback_questions')
                        .select('*')
                        .order('order', { ascending: true });
                    questionsToSend = globalQ || [];
                }

                if (questionsToSend.length === 0) {
                    console.log('No questions found for this rule. Skipping.');
                    continue; // Skip this schedule
                }

                let clientsToNotify: any[] = [];

                // 2. Determine Target
                if (schedule.client_id) {
                    // Target Specific Client
                    const { data: client } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('id', schedule.client_id)
                        .single();
                    if (client) clientsToNotify = [client];

                } else if (schedule.service_type) {
                    // Target Service Type
                    const { data: clients } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('service_type', schedule.service_type)
                        .in('status', ['active', 'expiring']); // Only active clients

                    clientsToNotify = clients || [];
                }

                if (clientsToNotify.length > 0) {
                    // 3. Send Message to each client
                    for (const client of clientsToNotify) {
                        if (!client.phone) continue;

                        let message = `Fala ${client.name.split(' ')[0]}! Tudo certo? \n\nChegou a hora do nosso check-in (${schedule.name}). Por favor, responda as perguntas abaixo:\n\n`;
                        questionsToSend.forEach((q: any, idx: number) => {
                            message += `${idx + 1}. ${q.text}\n`;
                        });
                        message += `\nAguardo seu retorno! 💪`;

                        // Send (Async, don't block loop too much)
                        sendEvolutionMessage(client.phone, message).then(success => {
                            if (success) console.log(`Feedback request sent to ${client.name}`);
                        });
                    }
                } else {
                    console.log(`No active clients found for target.`);
                }

                // 4. Update Next Run
                const nextRun = new Date();
                nextRun.setDate(nextRun.getDate() + schedule.frequency_days);

                await supabase
                    .from('feedback_schedules')
                    .update({ next_run_at: nextRun.toISOString() })
                    .eq('id', schedule.id);
            }
        }

    } catch (err) {
        console.error('Error checking feedback automation:', err);
    }
}
async function checkRenewals() {
    try {
        // 1. Get Personal Phone
        const { data: settings } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'personal_phone')
            .single();

        const personalPhone = settings?.value;

        if (!personalPhone) return; // No phone configured, skip

        // 2. Find expiring clients (<= 7 days) who haven't been notified yet
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        const { data: expiringClients, error } = await supabase
            .from('clients')
            .select('id, name, end_date, plan_type, phone') // Added phone
            .in('status', ['active', 'expiring']) // Only active or already marked expiring
            .lte('end_date', nextWeek.toISOString().split('T')[0]) // Expiring soon
            .eq('renewal_notice_sent', false); // Not notified yet

        if (error) throw error;

        if (expiringClients && expiringClients.length > 0) {
            console.log(`Found ${expiringClients.length} clients expiring without notice.`);

            // 3. Construct Message
            let message = `⚠️ *Alerta de Renovação - MUDASHAPE*\n\nExistem alunos com planos vencendo em breve:\n`;

            expiringClients.forEach(client => {
                const endDate = new Date(client.end_date).toLocaleDateString('pt-BR');
                message += `• *${client.name}* (${client.phone}) - ${client.plan_type}\n  Vence em: ${endDate}\n`;
            });

            message += `\nEntre em contato para renovar! 🚀`;

            // 4. Send to Personal
            const success = await sendEvolutionMessage(personalPhone, message);

            if (success) {
                console.log('✅ Renewal alert sent to Personal Trainer.');

                // 5. Mark as notified
                const ids = expiringClients.map(c => c.id);
                await supabase
                    .from('clients')
                    .update({ renewal_notice_sent: true })
                    .in('id', ids);
            }
        } else {
            console.log(`Checked for renewals: None found expiring in the next 7 days.`);
        }

    } catch (err) {
        console.error('Error checking renewals:', err);
    }
}
