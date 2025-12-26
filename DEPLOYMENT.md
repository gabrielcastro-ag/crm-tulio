# Guia de Deploy - Mudashape

Como o sistema possui duas partes (o **Site** que você vê e o **Robô Agendador** que roda no fundo), a recomendação ideal é usar o melhor de cada hospedagem que você possui.

## Resumo da Recomendação

| Componente | Onde Hospedar? | Por que? |
| :--- | :--- | :--- |
| **Frontend (Site)** | **Hospedagem Compartilhada** | É mais barato/simples. O site vira apenas arquivos estáticos (HTML/JS) após o build. |
| **Agendador (Robô)** | **VPS** | Precisa de um "motor" (Node.js) rodando 24 horas por dia sem parar. Hospedagens compartilhadas geralmente matam processos de longa duração. |

---

## Passo 1: Publicando o Site (Frontend)

Você pode hospedar o visual do sistema na sua hospedagem compartilhada (Hostgator, locaweb, etc) ou na mesma VPS, se preferir.

1. **No seu computador**, gere a versão de produção:
   ```bash
   npm run build
   ```
   Isso vai criar uma pasta chamada `dist`.

2. **Na Hospedagem Compartilhada**:
   - Abra o Gerenciador de Arquivos (cPanel) ou FTP.
   - Entre na pasta `public_html` (ou subdomínio).
   - Faça upload de **todo o conteúdo de dentro da pasta `dist`**.

   *Pronto! O site já estará acessível para uso.*

---

## Passo 2: Configurando o Robô (VPS)

O robô precisa ficar ligado o tempo todo para verificar os horários.

1. **Acesse sua VPS** via terminal (SSH).

2. **Instale o Node.js** (se ainda não tiver):
   ```bash
   # Exemplo para Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Suba o Projeto**:
   - Você não precisa subir a pasta `dist` nem `node_modules`.
   - Suba os arquivos: `package.json`, `package-lock.json`, `.env`, `tsconfig.json`, `vite.config.ts`.
   - Suba as pastas: `services` e `components` (o scheduler usa alguns arquivos de lá).
   - *Dica: Se achar mais fácil, pode subir o projeto todo (exceto `node_modules`), não tem problema.*

4. **Instale as dependências e o PM2**:
   O PM2 é um gerenciador que mantém o robô rodando mesmo se o servidor reiniciar ou se der erro.
   ```bash
   # Na pasta do projeto na VPS
   npm install
   npm install -g pm2
   ```

5. **Inicie o Robô**:
   ```bash
   pm2 start npm --name "mudashape-scheduler" -- run scheduler
   ```

6. **Verifique se está rodando**:
   ```bash
   pm2 logs
   ```
   Você deve ver mensagens como "Checking for pending messages...".

7. **Salvar para iniciar com o Windows/Linux**:
   ```bash
   pm2 save
   pm2 startup
   ```

---

## Atualizações Futuras

- **Se mudar algo no visual**: Rode `npm run build` e suba a pasta `dist` novamente para a hospedagem.
- **Se mudar algo na lógica do Robô**: Suba o arquivo `services/scheduler.ts` atualizado para a VPS e rode `pm2 restart mudashape-scheduler`.
