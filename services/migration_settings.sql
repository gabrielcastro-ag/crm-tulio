-- Migration: App Settings & Notifications
-- Run this in Supabase SQL Editor

-- 1. Create Settings Table (Key-Value)
create table public.app_settings (
  key text primary key,
  value text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Insert default Personal Phone (Empty initially)
insert into public.app_settings (key, value) values ('personal_phone', '');

-- 3. Add notification flag to clients
alter table public.clients add column renewal_notice_sent boolean default false;

-- 4. Enable RLS
alter table public.app_settings enable row level security;
create policy "Allow all access" on public.app_settings for all using (true) with check (true);
