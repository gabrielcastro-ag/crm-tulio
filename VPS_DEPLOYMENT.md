# 🚀 Guia de Deploy Híbrido (VPS + Hospedagem Compartilhada)

Como você possui uma **VPS** e uma **Hospedagem Compartilhada**, a melhor estratégia é dividir o sistema para economizar recursos e facilitar a gestão.

---

## 📂 Visão Geral da Separação

| Componente | Onde vai rodar? | Motivo |
| :--- | :--- | :--- |
| **Frontend (Site/Painel)** | **Hospedagem Compartilhada** | É apenas estático (HTML/JS/CSS). Não consome CPU da VPS. |
| **Backend (IA + Agendador)** | **VPS** | Precisa de Node.js rodando 24/7 e portas abertas para Webhook. |
| **Banco de Dados** | **Supabase (Cloud)** | Já está na nuvem, acessível por ambos. |

---

## 1️⃣ Parte da Hospedagem Compartilhada (Frontend)

Aqui vamos subir apenas o "site".

1.  No seu computador local (VS Code), gere os arquivos finais:
    ```bash
    npm run build
    ```
2.  Será criada uma pasta chamada `dist`.
3.  **Acesse o gerenciador de arquivos da Hospedagem** (cPanel/FTP).
4.  Abra a pasta `public_html` (ou subdomínio desejado).
5.  **Faça o upload** de todo o conteúdo de DENTRO da pasta `dist` para lá.
    *   Arquivos: `index.html`, `assets/`, etc.
6.  **Pronto!** O painel já estará acessível pelo seu domínio.

---

## 2️⃣ Parte da VPS (Cérebro do Sistema)

Aqui vamos subir o código que processa a IA e manda mensagens.

### A. Preparação dos Arquivos
Você precisa copiar **TODA a pasta do projeto** para a VPS.
> *Dica: Você pode usar git se tiver, ou zipar a pasta `mudashape` (sem `node_modules`) e subir via SFTP/FileZilla.*

Estrutura na VPS (exemplo: `/root/mudashape`):
- `package.json`
- `ecosystem.config.cjs` (Arquivo novo que criei para gerenciar processos)
- `services/`
- `.env` (Não esqueça de configurar as chaves aqui também!)

### B. Instalação na VPS
Acesse a VPS via terminal (SSH) e rode na pasta do projeto:

1.  **Instale as dependências:**
    ```bash
    npm install
    npm install -g pm2
    ```
    *(O `pm2` é um gerenciador que mantém o servidor rodando mesmo se você fechar o terminal)*

2.  **Inicie os serviços:**
    ```bash
    pm2 start ecosystem.config.cjs
    ```

3.  **Verifique se está rodando:**
    ```bash
    pm2 status
    pm2 logs
    ```

4.  **Salve para iniciar com o sistema (caso reinicie a VPS):**
    ```bash
    pm2 save
    pm2 startup
    ```

---

## 🔗 Conectando as Pontas

Como o Frontend está na hospedagem e o Backend na VPS, eles precisam se conversar em um ponto específico: **Webhooks**.

- **Frontend:** Fala direto com o Supabase. Não precisa configurar IP da VPS nele.
- **WhatsApp (Evolution):** Precisa mandar as mensagens para a VPS.
    - Configure na Evolution API o Webhook para: `http://IP-DA-SUA-VPS:3001/webhook/evolution`
    - (Lembre-se de liberar a porta 3001 no Firewall da VPS).

---

## ✅ Resumo
- **Hospedagem:** Recebe o conteúdo da pasta `dist` (Build).
- **VPS:** Recebe o código todo, mas roda apenas os serviços via `pm2`.
