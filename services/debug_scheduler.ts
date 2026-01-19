
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDebug() {
    const now = new Date().toISOString();
    console.log(`Current Time (Machine): ${new Date().toString()}`);
    console.log(`Current Time (ISO/UTC): ${now}`);

    console.log('--- Checking ALL Pending Schedules (No Date Filter) ---');
    const { data: allPending, error: error1 } = await supabase
        .from('schedules')
        .select('id, date, status, client_id, message')
        .eq('status', 'pending');

    if (error1) console.error(error1);
    else {
        console.log(`Found ${allPending?.length} total pending items.`);
        allPending?.forEach(item => {
            console.log(`- ID: ${item.id} | Date: ${item.date} | Status: ${item.status}`);
            console.log(`  LTE Check: '${item.date}' <= '${now}' ? ${item.date <= now}`);
        });
    }

    console.log('\n--- Checking Filtered Schedules (lte date, now) ---');
    const { data: filtered, error: error2 } = await supabase
        .from('schedules')
        .select('*')
        .eq('status', 'pending')
        .lte('date', now);

    if (error2) console.error(error2);
    else {
        console.log(`Found ${filtered?.length} items matching query.`);
    }
}

runDebug();
