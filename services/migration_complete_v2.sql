-- COMPLETED MIGRATION SCRIPT (SAFE TO RUN)
-- This script safely creates the table if it doesn't exist, and adds new columns if they are missing.

-- 1. Create table 'feedback_schedules' if it does not exist
create table if not exists public.feedback_schedules (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  service_type text, -- made nullable for V2 compliance
  frequency_days int not null,
  next_run_at timestamp with time zone default now(),
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS (if not already enabled)
alter table public.feedback_schedules enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Allow all access' and tablename = 'feedback_schedules') then
    create policy "Allow all access" on public.feedback_schedules for all using (true) with check (true);
  end if;
end $$;

-- 3. Add V2 Columns (Safe checks)

-- Add 'questions' column
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'feedback_schedules' and column_name = 'questions') then
    alter table public.feedback_schedules add column questions jsonb default '[]'::jsonb;
  end if;
end $$;

-- Add 'client_id' column
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'feedback_schedules' and column_name = 'client_id') then
    alter table public.feedback_schedules add column client_id uuid references public.clients(id) on delete cascade;
  end if;
end $$;

-- 4. Ensure service_type is nullable (V2 requirement)
alter table public.feedback_schedules alter column service_type drop not null;

-- 5. Add 'schedules' table for Bulk Queue (if not exists)
create table if not exists public.schedules (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade,
    date timestamp with time zone not null,
    type text check (type in ('workout', 'diet', 'checkin', 'general')),
    message text,
    attachment_url text,
    attachment_name text,
    status text default 'pending' check (status in ('pending', 'sent'))
);
