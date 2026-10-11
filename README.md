# Orquestra

Aplicativo desktop (Ubuntu e Windows) com uma tela infinita onde cada terminal é um bloco que você arrasta, redimensiona e liga a outros por setas. Feito para acompanhar vários agentes de código (Claude Code, Codex etc.) ao mesmo tempo, organizados em sessões.

## Instalar

### Ubuntu (versão mais recente)

Gere o instalador (veja "Desenvolver") ou use um `.deb` pronto e instale:

```bash
sudo apt install ./orquestra_0.1.0_amd64.deb
```

O Orquestra aparece no menu de aplicativos. Para desinstalar, saia do Orquestra e rode `sudo apt remove orquestra`: o aplicativo, o atalho e as sessões salvas são apagados; seus projetos, worktrees e branches não são tocados.

### Windows

Rode o `Orquestra Setup 0.1.0.exe`. Ele instala para o seu usuário e cria atalhos no menu Iniciar e na área de trabalho. Para desinstalar, use "Aplicativos instalados" nas Configurações; as sessões salvas também são apagadas.

### O que precisa estar instalado

Git, VS Code (comando `code`) e os agentes que você quiser usar (`claude`, `codex`). O Orquestra não instala nenhum deles.

## Como usar

- **Sessões:** cada aba é uma sessão com seu próprio quadro. **＋** cria uma sessão, duplo clique no nome renomeia, **✕** fecha (só depois de finalizar todos os terminais dela). Quando um terminal de outra sessão precisa de você, a aba dela mostra um ponto vermelho.
- **+ Terminal** (ou tecla `N`): escolha nome (opcional), pasta (digitando ou em **Procurar…**), onde abrir (pasta, worktree existente ou novo worktree) e o agente (Claude, Codex ou nenhum). Uma branch nova parte da branch atual da pasta original do projeto; o worktree fica ao lado do projeto (`projeto-nome-da-branch`).
- **VS Code** abre a pasta do terminal no VS Code para ver o que mudou. **⤢** foca o terminal com zoom 100%. **↻** reinicia.
- **✕ finaliza** o terminal: dá para só fechar ou fechar e excluir o worktree e a branch. A exclusão só acontece se nada for perdido: sem alterações não commitadas, branch já integrada na principal (ou sem commits próprios) e nenhum outro terminal aberto no mesmo worktree.
- **Setas:** **→ Comando** (de quem comanda para quem é comandado) e **⇢ Dependência** (do dependente para o responsável). Clique no botão, depois no terminal de origem e no de destino; `Esc` cancela. Clique numa seta para mudar o tipo ou removê-la.
- **Mover a tela:** arraste o fundo. **Zoom:** roda do mouse no fundo, ou `Ctrl` + roda em qualquer lugar. **Ver todos** (`F`) enquadra os terminais da sessão.
- **Renomear terminal:** duplo clique no nome.

### Status de cada terminal

- 🟢 **trabalhando:** saiu algo no terminal nos últimos 2,5 s
- 🟡 **parado:** sem saída há um tempo (terminou ou está esperando você)
- 🔴 **precisa de você:** o terminal tocou o "sino". Também aparece na aba da sessão, no título da janela e numa notificação do sistema.

Para o Claude Code tocar o sino quando precisar de aprovação, configure o canal de notificação dele para o sino do terminal (`/config` dentro do Claude Code).

### Maestro: um terminal que abre outros

Dentro de qualquer terminal do Orquestra existe o comando `orquestra-abrir`, que abre um novo terminal na mesma sessão, já ligado por uma seta de comando:

```bash
orquestra-abrir --pasta ../projeto-minha-tarefa --nome "tarefa" --agente claude
```

`--nome` e `--agente` são opcionais. Assim, o terminal que você usa como maestro pode criar branch e worktree com suas skills e abrir o terminal da tarefa.

### Fechar a janela não para os agentes

Fechar a janela só a esconde: os agentes continuam rodando e as notificações continuam chegando. Abra de novo pelo menu de aplicativos ou pelo ícone na bandeja. Para encerrar de verdade, use **Sair** (na barra ou no ícone da bandeja), que pede confirmação. Ao abrir o Orquestra depois, as sessões voltam com o mesmo layout e cada terminal reabre na mesma pasta com o mesmo agente (o histórico anterior não volta). Terminais cuja pasta não existe mais não são restaurados, e o Orquestra avisa quais ficaram de fora.

## Segurança

O servidor interno só escuta em `127.0.0.1` e recusa pedidos vindos de sites abertos no navegador. Os terminais rodam com o seu usuário.

## Desenvolver

Precisa do Node.js 18 ou mais novo e das ferramentas de compilação (o `node-pty` é compilado para o Electron no `npm install`):

- **Ubuntu:** `sudo apt install build-essential python3`
- **Windows:** Visual Studio Build Tools com "Desenvolvimento para desktop com C++" e Python.

```bash
npm install
npm start          # abre o aplicativo
npm test           # testes das regras de Git
npm run dist:linux # gera dist/orquestra_<versão>_amd64.deb
npm run dist:win   # gera dist/Orquestra Setup <versão>.exe (rodar no Windows)
```

O instalador do Windows precisa ser gerado no próprio Windows, porque o `node-pty` é compilado para o sistema em que o build roda.

No Ubuntu, o aplicativo usa X11 (XWayland) mesmo em sessões Wayland (`--ozone-platform=x11`), porque o Electron fecha com erro ao abrir janelas direto no Wayland do Ubuntu 26.04.

## Estrutura

- `electron/main.js`: janela, bandeja, confirmação ao sair e instância única.
- `electron/preload.js`: funções do aplicativo que a página pode usar (escolher pasta, sair).
- `server.js`: servidor Express + WebSocket; guarda sessões, terminais e setas em `estado.json` na pasta de dados do aplicativo e abre cada terminal com `node-pty`.
- `git.js`: worktrees, branches e a verificação que impede excluir trabalho não integrado.
- `public/index.html`: a interface (xterm.js para desenhar os terminais).
- `bin/`: o comando `orquestra-abrir`.
- `build/`: ícone e scripts de desinstalação do `.deb`.
