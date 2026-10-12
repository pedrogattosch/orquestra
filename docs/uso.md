# Guia de uso

## Sessões

Cada aba é uma sessão com seu próprio quadro. **＋** cria uma sessão, duplo clique na aba renomeia e **✕** fecha (só depois de finalizar todos os terminais dela; se houver anotações, pede confirmação, porque elas são apagadas junto). Quando um terminal de outra sessão precisa de você, a aba dela mostra um ponto vermelho.

## Terminais

- **+ Terminal** (ou tecla `N`): escolha a pasta (digitando ou em **Procurar…**), onde abrir (pasta, worktree existente, novo worktree com branch nova ou novo worktree de branch existente) e o agente (Claude, Codex ou nenhum).
- Uma branch nova parte da branch atual da pasta original do projeto. O worktree fica ao lado do projeto; o nome dele vem preenchido com `projeto-nome-da-branch` e pode ser editado.
- **Expandir** abre o terminal na tela toda; **Recolher** o devolve ao quadro.
- **Abrir** abre a pasta do terminal no VS Code para ver o que mudou.
- **Finalizar** fecha o terminal: dá para só fechar ou fechar e excluir o worktree e a branch. A exclusão só acontece se nada for perdido: sem alterações não commitadas, branch já integrada na principal (ou sem commits próprios) e nenhum outro terminal aberto no mesmo worktree.
- Se o processo do terminal terminar (por exemplo, com `exit`), aperte Enter dentro dele para reiniciá-lo na mesma pasta.
- **Renomear terminal:** duplo clique no cabeçalho.

## Conexões (setas)

**→ Comando** vai de quem comanda para quem é comandado; **⇢ Dependência** vai do dependente para o responsável. Clique em **Nova conexão** (ou tecla `C`), escolha o tipo na barra que aparece e clique no terminal de origem e depois no de destino; `Esc` cancela. Clique numa seta para mudar o tipo ou removê-la.

## Anotações

Clique em **Anotação** (ou tecla `A`): o cursor vira um lápis. Escolha o tamanho e a cor na barra que aparece e clique no quadro onde quer escrever; `Esc` cancela. A anotação cresce conforme você escreve. Dentro dela, cada trecho pode ter tamanho e cor próprios: selecione o texto e escolha na barra, ou escolha antes de digitar para mudar o que vem a seguir. Arraste pela barra que aparece ao passar o mouse e apague no **✕**; uma anotação deixada em branco some sozinha.

## Tela

Arraste o fundo para mover a tela. Zoom com a roda do mouse no fundo, ou `Ctrl` + roda em qualquer lugar. **Ver todos** (`F`) enquadra os terminais da sessão.

Para mandar um print a um agente, copie a imagem e cole no terminal com `Ctrl+V`: o Orquestra a salva num arquivo temporário e cola o caminho, como se a imagem tivesse sido arrastada para o terminal (o Claude Code mostra `[Image #1]`).

## Status de cada terminal

- 🟢 **trabalhando:** saiu algo no terminal nos últimos 2,5 s
- 🟡 **parado:** sem saída há um tempo (terminou ou está esperando você)
- 🔴 **precisa de você:** o terminal tocou o "sino", mandou uma notificação (OSC 9, 777 ou 99) ou, se tem agente, trabalhou por alguns segundos e parou de escrever (terminou ou está esperando você).

Cada aba de sessão tem uma bolinha com o estado da sessão: vermelha pulsando quando algum terminal precisa de você, verde quando algum está trabalhando e amarela quando todos estão parados.

Quando um terminal precisa de você, de qualquer sessão, aparece um aviso pequeno no canto inferior esquerdo. Clique nele para ir à sessão e ao terminal; ele some sozinho depois de alguns segundos. Com a janela em segundo plano ou fechada, também aparece uma notificação do sistema. Não há aviso sobre o terminal que você está usando.

## Tema claro com o Claude Code

O Claude Code usa o tema escuro por padrão e pinta fundos escuros (mensagens enviadas, diffs) mesmo num terminal claro. Rode `/theme` dentro do Claude Code e escolha **Auto (match terminal)**: ele passa a seguir o tema do Orquestra ao abrir. O Orquestra também ajusta automaticamente cores de texto com pouco contraste para que continuem legíveis.

## Maestro: um terminal que abre outros

Dentro de qualquer terminal do Orquestra existe o comando `orquestra-abrir`, que abre um novo terminal na mesma sessão, já ligado por uma seta de comando:

```bash
orquestra-abrir --pasta ../projeto-minha-tarefa --nome "tarefa" --agente claude
```

`--nome` e `--agente` são opcionais.

No Ubuntu, nem é preciso chamar o `orquestra-abrir`: quando um terminal do Orquestra cria uma worktree com `git worktree add` (por exemplo, por uma skill que cria branch e worktree), o terminal da tarefa abre sozinho nessa worktree, com o mesmo agente, o nome da branch e a seta de comando. Se já houver um terminal aberto nela, nada muda. Terminais abertos antes de atualizar o Orquestra só ganham isso depois de reiniciados.

## Fechar a janela não para os agentes

Fechar a janela só a esconde: os agentes continuam rodando e as notificações continuam chegando. Abra de novo pelo menu de aplicativos, pela dock ou pelo ícone na bandeja. Para encerrar de verdade, use **Sair** (na barra ou no ícone da bandeja), que pede confirmação.

Ao abrir o Orquestra depois, as sessões voltam com o mesmo layout e cada terminal reabre na mesma pasta com o mesmo agente (o histórico anterior não volta). Terminais cuja pasta não existe mais não são restaurados, e o Orquestra avisa quais ficaram de fora.

## Segurança

O servidor interno só escuta em `127.0.0.1` e recusa pedidos vindos de sites abertos no navegador. Os terminais rodam com o seu usuário.
