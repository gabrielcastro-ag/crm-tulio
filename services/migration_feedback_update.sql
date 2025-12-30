-- Migration: Feedback Automation Schedules
-- Run this in Supabase SQL Editor

create table public.feedback_schedules (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- e.g. "Weekly Mudashape Check-in"
  service_type text not null, -- e.g. "Mudashape", "Consultoria"
  frequency_days int not null, -- e.g. 7, 15, 30
  next_run_at timestamp with time zone default now(),
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.feedback_schedules enable row level security;
create policy "Allow all access" on public.feedback_schedules for all using (true) with check (true);
