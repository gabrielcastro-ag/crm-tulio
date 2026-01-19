-- Migration: Feedback Link Support

-- 1. Make 'answers' nullable because we create the row BEFORE the user answers
ALTER TABLE public.feedback_submissions
ALTER COLUMN answers DROP NOT NULL;

-- 2. Add 'questions_snapshot' to store the exact questions asked (JSONB)
-- This ensures that if the global questions change, the old feedbacks remain consistent
ALTER TABLE public.feedback_submissions
ADD COLUMN questions_snapshot JSONB DEFAULT '[]'::JSONB;

-- 3. Add 'link_opened_at' to track if user opened it
ALTER TABLE public.feedback_submissions
ADD COLUMN link_opened_at TIMESTAMP WITH TIME ZONE;
