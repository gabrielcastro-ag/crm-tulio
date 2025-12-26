
-- Tabela de Clientes
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  phone text,
  email text,
  start_date date,
  end_date date,
  plan_type text,
  amount numeric,
  status text check (status in ('active', 'expiring', 'expired', 'pending')),
  notes text,
  avatar_url text
);

-- Tabela de Agendamentos (Treinos, Dietas, Mensagens)
create table public.schedules (
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

-- Tabela de Perguntas de Feedback (Configuração)
create table public.feedback_questions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    text text not null,
    "order" integer default 0
);

-- Tabela de Respostas de Feedback
create table public.feedback_submissions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade,
    answers jsonb not null, -- Array de {question: string, answer: string}
    status text default 'pending' check (status in ('pending', 'reviewed'))
);

-- Storage Bucket para PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', true);

-- Políticas de Segurança (Row Level Security)
-- Habilitando para todos verem/editarem por enquanto (DEV MODE)
alter table public.clients enable row level security;
create policy "Allow all access" on public.clients for all using (true) with check (true);

alter table public.schedules enable row level security;
create policy "Allow all access" on public.schedules for all using (true) with check (true);

alter table public.feedback_questions enable row level security;
create policy "Allow all access" on public.feedback_questions for all using (true) with check (true);

alter table public.feedback_submissions enable row level security;
create policy "Allow all access" on public.feedback_submissions for all using (true) with check (true);

-- Storage Policies
create policy "Allow Public Access" on storage.objects for all using ( bucket_id = 'pdfs' );
create policy "Allow Upload" on storage.objects for insert with check ( bucket_id = 'pdfs' );
