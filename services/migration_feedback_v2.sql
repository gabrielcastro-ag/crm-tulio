-- Migration: Feedback Automation V2 (Custom Questions & Client Targeting)

-- 1. Add 'questions' column to store custom questions for each rule (JSONB array)
alter table public.feedback_schedules
add column questions jsonb default '[]'::jsonb;

-- 2. Add 'client_id' for specific targeting
alter table public.feedback_schedules
add column client_id uuid references public.clients(id) on delete cascade;

-- 3. Make 'service_type' nullable (since now we might target a client instead)
alter table public.feedback_schedules
alter column service_type drop not null;
