
# Instruções de Configuração - MUDASHAPE

Para que o sistema funcione corretamente, você precisa configurar o Banco de Dados no Supabase.

## 1. Banco de Dados (Supabase)
1. Acesse o painel do seu projeto no Supabase: [https://supabase.com/dashboard/project/gpmrqycyhhaqtbvryoue](https://supabase.com/dashboard/project/gpmrqycyhhaqtbvryoue)
2. Vá até a aba **SQL Editor** (ícone de terminal a esquerda).
3. Clique em **New Query**.
4. Copie TODO o conteúdo do arquivo `services/db_schema.sql` (que está na pasta do projeto) e cole no editor.
5. Clique em **Run** (botão verde).

Isso criará:
- Tabela `clients` (Clientes)
- Tabela `schedules` (Agendamentos)
- Tabelas de Feedback (`feedback_questions`, `feedback_submissions`)
- Bucket de Storage `pdfs` (para arquivos)
- Políticas de Segurança iniciais.

## 2. Evolution API (WhatsApp)
Atualmente o sistema está configurado para **Gerar Links** (WhatsApp Web) automaticamente.
Para ativar o envio automático via API:
1. Instale a Evolution API no seu servidor.
2. No arquivo `.env`, adicione:
   ```
   VITE_EVOLUTION_API_URL=https://sua-api.com
   VITE_EVOLUTION_API_KEY=sua-chave-global
   VITE_EVOLUTION_INSTANCE=NomeDaInstancia
   ```

## 3. Rodando o Projeto
Basta rodar normalmente:
```bash
npm run dev
```
