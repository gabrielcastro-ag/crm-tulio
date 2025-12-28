-- Migration: Add Service Types
-- Run this in Supabase SQL Editor

-- 1. Create table for allowed service types (dynamic list)
create table public.service_types (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique
);

-- 2. Insert default values
insert into public.service_types (name) values ('Mudashape'), ('Consultoria'), ('Atendimento Nutricional');

-- 3. Add column to clients table
alter table public.clients add column service_type text;

-- 4. Enable RLS for new table
alter table public.service_types enable row level security;
create policy "Allow all access" on public.service_types for all using (true) with check (true);
