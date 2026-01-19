
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log("DEBUG_START");
    console.log(`CONNECTING TO: ${process.env.VITE_SUPABASE_URL}`);
    const now = new Date().toISOString();
    console.log(`NOW: ${now}`);

    // Check last 5 rows created
    const { data: recent, error: errRecent } = await supabase
        .from('schedules')
        .select('id, created_at, date, status, message')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("--- RECENT ROWS ---");
    if (errRecent) console.log(`ERROR_RECENT: ${errRecent.message}`);
    else {
        recent?.forEach(r => console.log(JSON.stringify(r)));
    }
    console.log("-------------------");

    const { count: pendingCount, error: err1 } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

    console.log(`PENDING_COUNT_ALL: ${pendingCount}`);

    console.log("DEBUG_END");
}

run();
