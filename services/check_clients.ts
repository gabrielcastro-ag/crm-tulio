
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase Config');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const run = async () => {
    const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .ilike('phone', '%9375%');

    if (error) {
        console.error('Error fetching clients:', error);
        return;
    }

    console.log(JSON.stringify(clients, null, 2));
};

run();
