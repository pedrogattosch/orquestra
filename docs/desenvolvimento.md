# Desenvolvimento

## Preparar

Precisa do Node.js 18 ou mais novo e das ferramentas de compilação (o `node-pty` é compilado para o Electron no `npm install`):

- **Ubuntu:** `sudo apt install build-essential python3`
- **Windows:** Visual Studio Build Tools com "Desenvolvimento para desktop com C++" e Python.

## Comandos

```bash
npm install
npm start          # abre o aplicativo
npm test           # testes das regras de Git
npm run dist:linux # gera dist/orquestra_<versão>_amd64.deb
npm run dist:win   # gera dist/Orquestra Setup <versão>.exe (rodar no Windows)
```

O `npm start` não cria atalho no sistema: a janela abre, mas o Orquestra não fica no menu de aplicativos nem pode ser fixado na dock. Para usar como aplicativo, gere o `.deb` e instale com `sudo apt install ./dist/orquestra_0.1.0_amd64.deb`.

Só roda um Orquestra por vez (instalado ou pelo `npm start`): abrir um segundo apenas mostra a janela do que já está aberto.

O instalador do Windows precisa ser gerado no próprio Windows, porque o `node-pty` é compilado para o sistema em que o build roda.

Sem um computador com Windows, gere o `.exe` pelo GitHub Actions: o workflow "Instalador Windows" (`.github/workflows/instalador-windows.yml`) roda em cada pull request e também pode ser disparado pela aba Actions (só depois de estar na `main`). Ele roda `npm ci`, `npm test` e `npm run dist:win` num Windows, testa o instalador com `test/instalador-windows.ps1` e publica o `.exe` como artefato `instalador-windows` da execução. O teste instala o `.exe` em modo silencioso, confere os atalhos, abre o app, abre terminais pela API e pelo `orquestra-abrir`, reabre o app para ver a sessão restaurada e desinstala, conferindo que o app, os atalhos e as sessões salvas foram removidos. A janela, a bandeja, o botão do VS Code e as notificações não são testados. Para baixar pelo terminal: `gh run download <id-da-execução> -n instalador-windows`.

Para gerar localmente no Windows, instale Node.js, Git, Python e o Visual Studio Build Tools com "Desenvolvimento para desktop com C++", e rode `npm install` e `npm run dist:win`.

O instalador não tem assinatura digital, então o Windows SmartScreen mostra o aviso de "editor desconhecido" ao abrir; clique em "Mais informações" e "Executar assim mesmo".

No Ubuntu, o aplicativo usa X11 (XWayland) mesmo em sessões Wayland (`--ozone-platform=x11`), porque o Electron fecha com erro ao abrir janelas direto no Wayland do Ubuntu 26.04.

## Ver o site

O site de apresentação fica em `site/`: é uma página estática (`index.html` e `icon.png`), sem build nem dependências. Para vê-lo no navegador:

1. Na raiz do repositório, entre na pasta do site e suba um servidor local:

   ```bash
   cd site
   python3 -m http.server 8080
   ```

2. Abra `http://localhost:8080` no navegador.
3. Depois de editar o `index.html`, recarregue a página (`Ctrl+R`) para ver a mudança.
4. Para parar o servidor, aperte `Ctrl+C` no terminal.

Se aparecer `OSError: [Errno 98] Address already in use`, outro programa já usa a porta 8080 (muitas vezes, um servidor antigo esquecido em outro terminal, talvez servindo outra pasta). Troque o número da porta, por exemplo `python3 -m http.server 8081`, e abra `http://localhost:8081`. Para descobrir quem está na porta: `ss -ltnp | grep 8080`.

Abrir o `site/index.html` direto no navegador também funciona, mas o servidor local se comporta como a página publicada. As fontes vêm do Google Fonts: sem internet, a página aparece com as fontes do sistema.

Para conferir a página no tamanho de celular, use as ferramentas do desenvolvedor do navegador (`F12` e depois `Ctrl+Shift+M`).

## Estrutura

- `electron/main.js`: janela, bandeja, confirmação ao sair e instância única.
- `electron/preload.js`: funções do aplicativo que a página pode usar (escolher pasta, sair).
- `server.js`: servidor Express + WebSocket; guarda sessões, terminais, setas e anotações em `estado.json` na pasta de dados do aplicativo e abre cada terminal com `node-pty`.
- `git.js`: worktrees, branches e a verificação que impede excluir trabalho não integrado.
- `public/index.html`: a interface (xterm.js para desenhar os terminais).
- `bin/`: o comando `orquestra-abrir` e o `orquestra-worktree.js`, que pede o terminal de uma worktree recém-criada.
- `bin/shim/git`: intermediário do `git` que vem antes do git de verdade no PATH dos terminais (Linux e macOS). Repassa tudo ao git e, depois de um `git worktree add` que deu certo, chama o `orquestra-worktree.js`.
- `build/`: ícone e scripts de desinstalação do `.deb`.
- `site/`: site de apresentação, uma página estática.
