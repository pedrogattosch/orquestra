# Orquestra

Uma tela infinita no navegador onde cada terminal é um bloco que você arrasta, redimensiona e organiza. Feito para acompanhar vários agentes de código (Claude Code, Antigravity CLI, etc.) ao mesmo tempo.

## Instalar e rodar

Precisa do Node.js 18 ou mais novo.

```bash
cd orquestra
npm install
npm start
```

Abra **http://localhost:4321** no navegador.

### Se o `npm install` falhar no `node-pty`

O `node-pty` (que cria os terminais de verdade) às vezes precisa compilar:

- **Windows:** instale o Visual Studio Build Tools com a carga "Desenvolvimento para desktop com C++" e o Python, e rode `npm install` de novo. Alternativa: rodar tudo dentro do WSL.
- **Linux:** `sudo apt install build-essential python3` (ou equivalente) e `npm install` de novo.

## Como usar

- **+ Agente** (ou tecla `N`): escolha nome, pasta, comando (`claude`, o CLI do Antigravity, ou vazio para só um terminal).
- **Worktree:** preencha o nome da branch e ele cria `../projeto-branch` com `git worktree` e abre o agente lá dentro. Se o worktree já existir, só reutiliza.
- **Mover a tela:** arraste o fundo. **Zoom:** roda do mouse no fundo, ou `Ctrl` + roda em qualquer lugar.
- **Mover um terminal:** arraste pelo cabeçalho. **Redimensionar:** canto inferior direito.
- **Renomear:** duplo clique no nome.
- **⤢** foca o terminal com zoom 100% (melhor para selecionar texto). **↻** reinicia. **✕** encerra.
- **Grade** (`G`) organiza tudo automaticamente. **Ver todos** (`F`) enquadra todos os terminais.

### Status de cada terminal

- 🟢 **trabalhando:** saiu algo no terminal nos últimos 2,5 s
- 🟡 **parado:** sem saída há um tempo (terminou ou está esperando você)
- 🔴 **precisa de você:** o terminal tocou o "sino". Também aparece o número na aba do navegador e uma notificação do sistema.

Para o Claude Code tocar o sino quando precisar de aprovação, configure o canal de notificação dele para o sino do terminal (`/config` dentro do Claude Code).

### Recarregar não mata os agentes

Os terminais rodam no servidor. Se você recarregar ou fechar a aba, ao abrir de novo tudo volta no mesmo lugar, com o histórico. Só parar o servidor (`Ctrl+C`) encerra os agentes.

## Segurança

O servidor só escuta em `127.0.0.1` e recusa conexões vindas de outros sites. Ainda assim, ele abre terminais com o seu usuário: não exponha a porta na rede.

## Estrutura

- `server.js`: servidor Express + WebSocket; cada terminal é uma sessão `node-pty`.
- `public/index.html`: a tela infinita (xterm.js para desenhar os terminais).

Mude a porta com `PORT=5000 npm start`.
