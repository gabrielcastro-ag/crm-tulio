-- Adicionar campos de IA na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_mode TEXT DEFAULT 'standard';

-- Tabela para armazenar histórico de mensagens (Opcional, mas útil para contexto)
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT,
  metadata JSONB -- Para guardar info extra como tokens usados, tipo de media, etc.
);

-- RLS para nova tabela
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON public.ai_messages FOR ALL USING (true) WITH CHECK (true);
