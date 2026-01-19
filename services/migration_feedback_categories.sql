-- Migration: Add Category to Feedback Questions

ALTER TABLE feedback_questions 
ADD COLUMN category text DEFAULT 'Geral';

-- Update RLS to ensure new column is covered (Policy "Allow all access" usually covers all columns, but good to check)
-- No extra policy needed as "using (true)" covers everything.
