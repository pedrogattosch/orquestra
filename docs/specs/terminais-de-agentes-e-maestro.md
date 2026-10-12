# Terminais de agentes e maestro

## Objetivo

Permitir que a pessoa usuária abra, acompanhe e encerre vários terminais de agentes de código (Claude Code, Codex ou qualquer outro CLI) em um aplicativo desktop instalável no Ubuntu e no Windows, organizando o trabalho em várias sessões, uma para cada frente ou projeto. Em cada sessão, ela escolhe pasta, worktree e branch de cada terminal, abre o projeto no VS Code para ver o que foi alterado e liga terminais por setas que mostram a relação entre eles. Os agentes continuam rodando com a janela fechada, e ao reabrir o aplicativo tudo está como foi deixado; mesmo depois de sair do aplicativo, as sessões voltam com o mesmo layout. Um terminal pode abrir outros terminais; a pessoa usuária usa um deles, que chama de "maestro", para criar e limpar branches e worktrees com suas skills e abrir os terminais das tarefas.

## Contexto

Hoje o Orquestra é uma tela infinita no navegador em que cada terminal é um bloco arrastável e redimensionável. Para usá-lo, a pessoa usuária inicia um servidor local pelo terminal (`npm start`) e abre o endereço no navegador. Os terminais rodam no servidor e sobrevivem a recarregamentos da página; só param quando o servidor é encerrado. Existe um único quadro, com todos os terminais juntos.

O Orquestra passará a ser um aplicativo desktop para Ubuntu e Windows, distribuído por instalador.

Comportamento atual relevante:

- O botão **+ Agente** (tecla `N`) abre um formulário com nome, pasta do projeto, nome de branch para worktree (opcional) e comando inicial.
- Todos os campos são de texto livre. Não há lista de worktrees ou branches existentes; o comando inicial tem apenas sugestões.
- O campo de pasta vem preenchido com a pasta do último terminal aberto ou, se não houver, com a pasta em que o servidor foi iniciado.
- Quando uma branch é informada, o Orquestra cria (ou reaproveita) um worktree irmão do repositório no formato `<repo>-<branch>`, com caracteres especiais trocados por `-`.
- Cada terminal mostra o caminho e a branch no cabeçalho, além de um status: trabalhando, parado ou precisa de você.
- O cabeçalho de cada terminal tem os botões focar (⤢), reiniciar (↻) e fechar (✕). O ✕ encerra o processo do terminal e remove o bloco da tela, sem mexer em worktree nem branch.
- A barra superior tem o botão **Grade** (tecla `G`), que reorganiza todos os terminais em grade.
- Não há forma de abrir, a partir do Orquestra, o projeto de um terminal em um editor.
- Não há ligação visual entre terminais, nem forma de um terminal abrir outro.

A pessoa usuária já tem skills (por exemplo, `/iniciar`) que criam branch e worktree seguindo sua convenção pessoal. Ela chama de "maestro" o terminal em que usa essas skills, mas para o Orquestra o maestro é um terminal como qualquer outro.

## Escopo

1. Orquestra como aplicativo desktop para Ubuntu e Windows, aberto como um programa da máquina, sem precisar iniciar um servidor pelo terminal nem abrir o navegador.
2. Instalador e desinstalador para Ubuntu e para Windows.
3. Execução em segundo plano: fechar a janela não encerra os terminais; reabrir o aplicativo volta ao estado em que foi deixado.
4. Ação explícita para sair do aplicativo, com confirmação, que encerra os terminais.
5. Várias sessões, exibidas em abas, cada uma com seu próprio quadro, terminais e setas, com criação, troca, renomeação e fechamento de sessões, sendo o fechamento permitido só quando a sessão não tem terminais abertos.
6. Restauração das sessões e do layout ao abrir o aplicativo depois de ter saído dele ou de reiniciar o computador.
7. Formulário de novo terminal com:
   - nome da worktree, preenchido com `<projeto>-<branch>` e editável, ao criar um worktree;
   - seleção da pasta do projeto, digitando o caminho ou navegando pelas pastas, sem pasta pré-preenchida;
   - seleção de worktree entre os existentes no projeto escolhido, ou criação de um novo;
   - seleção de branch entre as existentes no projeto escolhido, ou criação de uma nova, com qualquer nome válido no Git, partindo da branch atual da pasta original do projeto;
   - seleção do agente a iniciar: Claude, Codex ou nenhum.
8. Remoção do campo de comando inicial do formulário, substituído pela seleção de agente.
9. Terminal sem nome quando é aberto sem nome.
10. Quadro vazio em uma sessão sem terminais.
11. Visualização simultânea dos terminais da sessão, mantendo o comportamento atual da tela infinita e dos status.
12. Botão por terminal que abre no VS Code a pasta ou o worktree daquele terminal.
13. Botão ✕ por terminal passando a ser o botão de finalizar, com a escolha entre só fechar o terminal ou fechar e excluir worktree e branch, sendo a exclusão bloqueada quando houver trabalho que se perderia.
14. Identificação automática da branch principal de cada repositório, usada para verificar se uma branch já foi integrada.
15. Abertura de terminais a partir de outro terminal, com seta de comando criada automaticamente, inclusive de forma automática quando um terminal cria um worktree.
16. Setas entre terminais da mesma sessão, de dois tipos visualmente diferentes:
    - **comando:** um terminal comanda outro (por exemplo, o maestro e seus sub-agentes);
    - **dependência:** a implementação de um terminal depende da de outro.
17. Editor de setas para criar, mudar o tipo e remover setas.
18. Persistência das sessões, terminais e setas enquanto o aplicativo estiver rodando, inclusive com a janela fechada, e do layout depois de sair do aplicativo.
19. Remoção da organização em grade (botão **Grade** e tecla `G`).

## Fora do escopo

- Suporte a macOS e a distribuições Linux diferentes do Ubuntu.
- Atualização automática do aplicativo.
- Iniciar o Orquestra automaticamente junto com o sistema; ele só abre quando a pessoa usuária o abre.
- Mover um terminal de uma sessão para outra.
- Fechar uma sessão com terminais abertos.
- Manter agentes rodando, ou restaurar o histórico dos terminais, depois de sair do aplicativo ou de desligar ou reiniciar o computador.
- Setas entre terminais de sessões diferentes.
- Delegação automática de tarefas, isto é, um terminal enviar instruções de trabalho aos terminais que abriu (prevista para uma entrega futura).
- Tratamento especial do maestro: ele não tem marcação, botão ou comportamento próprios no Orquestra.
- Exclusão forçada de worktree ou branch com trabalho sem merge ou sem commit.
- Botão de fechar separado do botão de finalizar.
- Imposição de convenção de nomes de branch ou worktree pelo Orquestra; a convenção fica a cargo das skills.
- Detecção automática pelo Orquestra de branches já integradas para limpeza em lote; essa limpeza é feita pelo maestro com as skills.
- Commit, push, abertura de pull request ou merge a partir do Orquestra.
- Edição de arquivos ou exibição de diff dentro do Orquestra.
- Acesso ao Orquestra a partir de outra máquina ou pela rede.
- Versão web do Orquestra mantida em paralelo ao aplicativo desktop.
- Instalação ou configuração dos CLIs de agente, do Git e do VS Code.

## Comportamento esperado

### Instalação

- Há um instalador para Ubuntu e outro para Windows.
- Depois de instalado, o Orquestra aparece no menu de aplicativos do sistema e pode ser aberto por ele.
- A pessoa usuária não precisa instalar Node.js nem rodar comandos no terminal para instalar ou abrir o Orquestra.
- O Orquestra só abre quando a pessoa usuária o abre, como qualquer outro aplicativo; ele não inicia junto com o sistema.
- Há um desinstalador para Ubuntu e outro para Windows, que removem o Orquestra, sua entrada no menu do sistema e as sessões e layouts guardados.
- O desinstalador não mexe em projetos, worktrees nem branches da pessoa usuária.
- Depois de desinstalar e instalar de novo, o Orquestra abre como na primeira vez, com uma sessão vazia.
- Se o Orquestra estiver rodando, o desinstalador não remove o aplicativo enquanto ele não for encerrado.

### Aplicativo desktop

- O Orquestra abre em uma janela própria, como um programa da máquina.
- Todas as funcionalidades desta especificação ficam disponíveis no Ubuntu e no Windows.
- Avisos de "precisa de você" continuam aparecendo como notificação do sistema, inclusive com a janela fechada.

### Segundo plano e reabertura

- Fechar a janela não encerra os terminais: os agentes continuam rodando em segundo plano.
- Enquanto o aplicativo estiver rodando em segundo plano, há uma forma visível de reabrir a janela e de sair do aplicativo.
- Ao reabrir a janela, a pessoa usuária volta para a sessão em que estava, com todas as sessões, terminais, posições, histórico e setas como foram deixados, e com a saída produzida pelos agentes enquanto a janela estava fechada.
- Abrir o Orquestra pelo menu do sistema enquanto ele já está rodando em segundo plano reabre a janela existente, sem iniciar uma segunda cópia.
- Ao pedir para sair, o Orquestra sempre pede confirmação, informando quantos terminais estão abertos. Se a pessoa usuária cancelar, nada é encerrado.
- Ao confirmar a saída, todos os terminais e agentes são encerrados.

### Abrir depois de sair

- Agentes não sobrevivem a sair do aplicativo nem a desligar ou reiniciar o computador.
- Ao abrir o Orquestra depois de ter saído dele, ou depois de reiniciar o computador, as sessões que estavam abertas voltam, com o mesmo layout:
  - mesmas sessões, com os mesmos nomes;
  - mesmos terminais, com os mesmos nomes, pastas ou worktrees, posições e tamanhos;
  - mesmas setas, com os mesmos tipos e ligações;
  - a mesma sessão que estava aberta por último.
- Os terminais restaurados abrem um shell novo na mesma pasta ou worktree e iniciam automaticamente o mesmo agente que tinham (Claude ou Codex). Terminais que estavam sem agente abrem só o shell.
- O histórico anterior dos terminais não é restaurado.
- Se a pasta ou o worktree de um terminal não existir mais, o terminal não é restaurado e o Orquestra informa qual terminal ficou de fora.

### Sessões

- O Orquestra tem várias sessões. Cada sessão tem seu próprio quadro, com seus terminais e setas.
- A pessoa usuária pode:
  - criar uma sessão nova, que começa com o quadro vazio;
  - dar nome a uma sessão e renomeá-la;
  - ver as sessões em abas e trocar de uma para outra;
  - fechar uma sessão, o que remove a aba dela.
- Uma sessão não está presa a um projeto: terminais da mesma sessão podem estar em pastas diferentes.
- Trocar de sessão não encerra nada: os terminais das outras sessões continuam rodando.
- Na primeira vez em que o Orquestra é aberto, existe uma sessão vazia.
- Um terminal aberto por outro terminal entra na mesma sessão do terminal que pediu a abertura.
- Uma sessão só pode ser fechada quando todos os seus terminais já foram finalizados. Se ainda houver terminais abertos, o Orquestra não fecha a sessão e informa quantos terminais faltam finalizar.
- Terminais não podem ser movidos de uma sessão para outra.
- A aba de cada sessão mostra um aviso quando algum terminal dessa sessão está com o status "precisa de você". O aviso some quando nenhum terminal da sessão precisa mais de atenção.
- O aviso aparece também na aba de sessões que não estão abertas no momento.

### Novo terminal

- O terminal é criado na sessão que está aberta.
- O formulário não tem mais o campo de comando inicial.
- O campo de pasta começa vazio, sem pasta sugerida. A pessoa usuária seleciona a pasta do projeto de uma destas formas:
  - digitando o caminho;
  - navegando pelas pastas.
- Se a pasta for um repositório Git, o formulário mostra os worktrees existentes desse repositório e as branches existentes.
- A pessoa usuária pode:
  - abrir o terminal na pasta principal do projeto;
  - abrir o terminal em um worktree existente;
  - criar um worktree novo com uma branch nova, com qualquer nome válido no Git;
  - criar um worktree novo a partir de uma branch existente que não esteja aberta em outro worktree.
- Uma branch nova parte da branch atual da pasta original do projeto. Se a pasta original estiver na `main`, a branch nova parte da `main`; se estiver em outra branch, parte dela.
- Se a pasta não for repositório Git, as opções de worktree e branch ficam indisponíveis e o terminal abre na pasta.
- O formulário não pede nome do terminal: ele abre sem nome e pode ser nomeado depois, com duplo clique no cabeçalho.
- Ao criar um worktree, o nome dele vem preenchido com `<projeto>-<branch>` e pode ser editado. Um nome de pasta que já existe é recusado.
- Se a criação do worktree falhar, o terminal não é aberto e a mensagem de erro do Git é exibida.
- A pessoa usuária escolhe o agente entre **Claude**, **Codex** ou **nenhum**.
- Com Claude ou Codex, o terminal abre na pasta escolhida e já inicia o agente. Com nenhum, abre só o shell.
- Se o agente for encerrado, o terminal continua aberto com o shell.

### Acompanhamento

- Os terminais continuam exibindo nome, caminho, branch e status (trabalhando, parado, precisa de você).
- O botão **Grade** e a tecla `G` deixam de existir. Os demais controles da tela (mover, zoom, **Ver todos**) permanecem e atuam na sessão aberta.
- Cada terminal tem os botões **Expandir** (tela toda), **Abrir** (VS Code) e **Finalizar**. Um terminal cujo processo terminou reinicia ao apertar Enter dentro dele.

### Abrir no VS Code

- Cada terminal tem um botão que abre no VS Code a pasta em que o terminal está trabalhando: o worktree, quando houver, ou a pasta do projeto.
- No VS Code, a pessoa usuária vê o que foi alterado com os recursos do próprio editor.
- Se o VS Code não puder ser aberto, o Orquestra exibe uma mensagem de erro.

### Finalizar (botão ✕)

- O botão ✕ do cabeçalho mantém o ícone atual e passa a ser o botão de finalizar. Não há outro botão de fechar.
- Ao acionar o ✕ em um terminal que está em um worktree, o Orquestra oferece duas opções:
  - **só fechar o terminal:** encerra o processo e remove o bloco da tela; worktree e branch continuam existindo;
  - **fechar e excluir worktree e branch:** encerra o processo, remove o bloco, exclui o worktree e exclui a branch.
- Em um terminal fora de worktree, a opção de excluir não é oferecida.
- A exclusão só é permitida quando nenhum trabalho se perderia, ou seja, quando as duas condições valem:
  - o worktree não tem alterações não commitadas;
  - a branch já foi integrada na branch principal do repositório ou não tem nenhum commit próprio, isto é, não tem alterações.
- Quando a exclusão não é permitida, o Orquestra não exclui nada, mantém o terminal aberto e informa o motivo (alterações não commitadas, branch sem merge na branch principal ou ambos). A pessoa usuária ainda pode escolher só fechar o terminal.
- Não há opção de forçar a exclusão.
- O caminho esperado para tarefas cujo merge ainda não aconteceu é só fechar o terminal e, depois do merge, fazer a limpeza pelo maestro.

### Branch principal

- O Orquestra identifica automaticamente a branch principal de cada repositório (por exemplo, `main` ou `master`).
- A verificação de merge ao finalizar usa essa branch principal.
- Se a branch principal não puder ser identificada, o Orquestra não exclui branch com commits próprios e informa que não conseguiu verificar o merge. Branch sem commits próprios continua podendo ser excluída.

### Abrir terminal a partir de outro terminal

- Qualquer terminal pode pedir ao Orquestra a abertura de um novo terminal, informando pelo menos a pasta ou o worktree em que ele deve abrir e, opcionalmente, o nome e o agente, entre as mesmas opções do formulário.
- Se o agente não for informado, o terminal abre só com o shell.
- Se o nome não for informado, o terminal fica sem nome.
- O novo terminal aparece na mesma sessão do terminal que pediu a abertura, como qualquer outro, com nome, caminho, branch e status, e pode ser acompanhado, aberto no VS Code e finalizado da mesma forma.
- O Orquestra cria automaticamente uma seta de **comando** do terminal que pediu a abertura para o terminal aberto.
- Esse é o recurso que a pessoa usuária usa no maestro: nele, roda um agente com suas skills para criar branch e worktree de uma tarefa, abrir o terminal dessa tarefa e, depois do merge, limpar branches e worktrees.
- Quando um terminal cria um worktree com `git worktree add` e o comando dá certo, o Orquestra abre sozinho um terminal nesse worktree, como se o terminal tivesse pedido a abertura: na mesma sessão, com seta de comando, com o mesmo agente do terminal que criou o worktree e com o nome da branch do worktree (ou o nome da pasta, se não houver branch).
- Essa abertura automática não acontece se já houver um terminal aberto no worktree, nem quando o worktree é criado pelo formulário de novo terminal, que já abre o seu.
- No Windows, a abertura automática ainda não está disponível; lá, o terminal da tarefa é aberto pedindo a abertura.
- Worktrees e branches criados ou removidos por um terminal passam a aparecer, ou deixam de aparecer, no formulário de novo terminal na próxima vez em que ele é aberto.

### Setas

- Há dois tipos de seta, com aparência diferente:
  - **comando:** aponta do terminal que comanda para o terminal comandado;
  - **dependência:** aponta do terminal dependente para o terminal responsável pela implementação da qual ele depende.
- Setas só ligam terminais da mesma sessão.
- As setas são apenas visuais: não enviam texto nem comandos entre terminais.
- As setas acompanham os terminais quando eles são movidos ou redimensionados.
- Quando um terminal é finalizado, as setas ligadas a ele somem.
- Ao reabrir a janela ou recarregar a interface, as setas voltam junto com os terminais, com os mesmos tipos e ligações.

### Editor de setas

- A pessoa usuária pode, pela tela:
  - criar uma seta entre dois terminais da sessão, escolhendo o tipo;
  - mudar o tipo de uma seta existente;
  - remover uma seta, inclusive as criadas automaticamente.
- A seta criada tem origem e destino escolhidos pela pessoa usuária, respeitando o sentido de cada tipo.
- Não é possível criar uma seta de um terminal para ele mesmo.

## Critérios de aceite

### Instalação e aplicativo

- Dado um computador com Ubuntu sem o Orquestra, quando a pessoa usuária roda o instalador para Ubuntu, então o Orquestra aparece no menu de aplicativos e abre em uma janela própria.
- Dado um computador com Windows sem o Orquestra, quando a pessoa usuária roda o instalador para Windows, então o Orquestra aparece no menu Iniciar e abre em uma janela própria.
- Dado um computador sem Node.js, quando a pessoa usuária instala e abre o Orquestra, então ele funciona sem que ela rode comandos no terminal.
- Dado o Orquestra instalado no Ubuntu ou no Windows, quando a pessoa usuária roda o desinstalador, então o Orquestra, sua entrada no menu do sistema e as sessões e layouts guardados são removidos, e projetos, worktrees e branches continuam intactos.
- Dado que o Orquestra foi desinstalado, quando a pessoa usuária o instala e abre de novo, então aparece só uma sessão vazia.
- Dado o Orquestra aberto no Ubuntu ou no Windows, quando a pessoa usuária usa as funcionalidades desta especificação, então todas funcionam nos dois sistemas.
- Dado um terminal que tocou o sino, quando a janela está fechada ou em segundo plano, então aparece uma notificação do sistema.

### Segundo plano e reabertura

- Dado um agente trabalhando, quando a pessoa usuária fecha a janela, então o agente continua rodando.
- Dado que a janela foi fechada com agentes rodando, quando a pessoa usuária reabre o Orquestra, então volta para a mesma sessão, com terminais, posições, setas e histórico preservados, incluindo a saída produzida com a janela fechada.
- Dado que o Orquestra está rodando em segundo plano, quando a pessoa usuária o abre de novo pelo menu do sistema, então a janela existente reaparece e nenhuma segunda cópia é iniciada.
- Dado que o Orquestra está rodando em segundo plano, quando a pessoa usuária procura como sair, então encontra uma forma visível de sair do aplicativo.
- Dado o Orquestra rodando, quando a pessoa usuária pede para sair, então aparece uma confirmação informando quantos terminais estão abertos.
- Dado a confirmação de saída, quando a pessoa usuária cancela, então nenhum terminal é encerrado e o aplicativo continua rodando.
- Dado a confirmação de saída, quando a pessoa usuária confirma, então todos os terminais e agentes são encerrados e o aplicativo deixa de rodar.
- Dado que a pessoa usuária saiu do aplicativo com duas sessões e terminais em posições definidas, quando abre o Orquestra de novo, então as duas sessões voltam com os mesmos nomes, terminais, pastas, posições, tamanhos e setas, na sessão que estava aberta por último.
- Dado que o computador foi reiniciado com o Orquestra rodando, quando a pessoa usuária abre o Orquestra, então as sessões voltam com o mesmo layout.
- Dado um terminal que rodava Claude ou Codex antes de sair, quando ele é restaurado, então abre na mesma pasta ou worktree com o mesmo agente iniciado e sem o histórico anterior.
- Dado um terminal que estava sem agente antes de sair, quando ele é restaurado, então abre só com o shell na mesma pasta ou worktree.
- Dado um terminal cujo worktree foi removido enquanto o Orquestra estava fechado, quando o Orquestra é aberto, então esse terminal não é restaurado e o Orquestra informa que ele ficou de fora.
- Dado que a pessoa usuária ligou o computador, quando entra no sistema, então o Orquestra não abre sozinho.

### Sessões

- Dado o Orquestra aberto pela primeira vez, quando a janela aparece, então existe uma sessão com o quadro vazio.
- Dado uma sessão aberta, quando a pessoa usuária cria uma sessão nova, então a nova sessão abre em uma aba nova com o quadro vazio e a anterior continua em sua aba.
- Dado uma sessão, quando a pessoa usuária a renomeia, então o novo nome aparece na aba da sessão.
- Dado terminais rodando na sessão A, quando a pessoa usuária troca para a sessão B, então os terminais de A continuam rodando e, ao voltar para A, estão como foram deixados.
- Dado uma sessão, quando a pessoa usuária abre terminais em pastas de projetos diferentes, então todos aparecem no quadro dessa sessão.
- Dado um terminal na sessão A, quando ele pede a abertura de um novo terminal, então o novo terminal aparece na sessão A.
- Dado um terminal da sessão B com status "precisa de você", quando a pessoa usuária está na sessão A, então a aba da sessão B mostra um aviso.
- Dado a aba de uma sessão com aviso, quando nenhum terminal dessa sessão precisa mais de atenção, então o aviso some.
- Dado uma sessão sem terminais abertos, quando a pessoa usuária a fecha, então a aba dela some.
- Dado uma sessão com terminais abertos, quando a pessoa usuária tenta fechá-la, então a sessão continua aberta e o Orquestra informa quantos terminais faltam finalizar.
- Dado um terminal em uma sessão, quando a pessoa usuária procura uma forma de movê-lo para outra sessão, então essa opção não existe.

### Novo terminal

- Dado uma sessão aberta, quando a pessoa usuária cria um terminal pelo formulário, então ele aparece no quadro dessa sessão.
- Dado o formulário de novo terminal, quando ele é aberto, então não há campo de comando inicial e o campo de pasta está vazio, mesmo que já tenham sido abertos terminais antes.
- Dado o formulário de novo terminal, quando a pessoa usuária digita o caminho de uma pasta ou a escolhe navegando pelas pastas, então essa pasta fica selecionada.
- Dado o formulário de novo terminal, quando a pessoa usuária escolhe o agente Claude, então o terminal abre e inicia o Claude na pasta escolhida.
- Dado o formulário de novo terminal, quando a pessoa usuária escolhe o agente Codex, então o terminal abre e inicia o Codex na pasta escolhida.
- Dado o formulário de novo terminal, quando a pessoa usuária escolhe nenhum agente, então o terminal abre só com o shell.
- Dado um terminal com agente, quando o agente é encerrado, então o terminal continua aberto com o shell.
- Dado uma pasta selecionada que é repositório Git, quando o formulário é exibido, então lista os worktrees existentes desse repositório e as branches existentes.
- Dado uma pasta que não é repositório Git, quando ela é selecionada, então as opções de worktree e branch ficam indisponíveis e o terminal abre na pasta.
- Dado um worktree existente selecionado, quando a pessoa usuária abre o terminal, então o terminal inicia dentro desse worktree e o cabeçalho mostra o caminho e a branch dele.
- Dado que a pessoa usuária informa um nome de branch nova qualquer, válido no Git, quando abre o terminal com criação de worktree, então o worktree e a branch são criados e o terminal inicia dentro do worktree.
- Dado uma branch nova criada pelo formulário, quando o worktree é criado, então a branch parte do commit atual da branch em que está a pasta original do projeto.
- Dado que a criação do worktree falha, quando a pessoa usuária tenta abrir o terminal, então nenhum terminal é aberto e a mensagem de erro é exibida.
- Dado que o nome do terminal ficou vazio, quando o terminal é aberto pelo formulário ou por outro terminal, então ele aparece sem nome, com caminho, branch e status.
- Dado a opção de worktree com branch nova, quando a pessoa usuária informa o nome de uma branch que já existe, então nenhum worktree é criado e o Orquestra informa que a branch já existe.

### Tela e VS Code

- Dado a tela do Orquestra, quando a pessoa usuária procura o botão **Grade** ou pressiona `G`, então o botão não existe e a tecla não reorganiza os terminais.
- Dado um terminal em um worktree, quando a pessoa usuária aciona o botão de abrir no VS Code, então o VS Code abre a pasta desse worktree.
- Dado um terminal sem worktree, quando a pessoa usuária aciona o botão de abrir no VS Code, então o VS Code abre a pasta do projeto.

### Finalizar

- Dado o cabeçalho de um terminal, quando ele é exibido, então tem o botão ✕ e nenhum outro botão de fechar.
- Dado um terminal em um worktree, quando a pessoa usuária aciona o ✕, então vê as opções "só fechar o terminal" e "fechar e excluir worktree e branch".
- Dado um terminal fora de worktree, quando a pessoa usuária aciona o ✕, então a opção de excluir worktree e branch não é oferecida.
- Dado a opção "só fechar o terminal", quando ela é escolhida, então o bloco sai da tela e o worktree e a branch continuam aparecendo no formulário de novo terminal.
- Dado um repositório cuja branch principal é `master`, quando a pessoa usuária exclui pelo ✕ uma branch já integrada na `master` e sem alterações não commitadas, então o worktree e a branch deixam de existir.
- Dado uma branch já integrada na branch principal e um worktree sem alterações não commitadas, quando a pessoa usuária escolhe "fechar e excluir worktree e branch", então o bloco sai da tela e o worktree e a branch deixam de existir.
- Dado uma branch sem commits próprios e um worktree sem alterações não commitadas, quando a pessoa usuária escolhe "fechar e excluir worktree e branch", então o bloco sai da tela e o worktree e a branch deixam de existir.
- Dado um worktree com alterações não commitadas, quando a pessoa usuária escolhe "fechar e excluir worktree e branch", então nada é excluído, o terminal continua aberto e o Orquestra informa que há alterações não commitadas.
- Dado uma branch com commits próprios ainda sem merge na branch principal, quando a pessoa usuária escolhe "fechar e excluir worktree e branch", então nada é excluído, o terminal continua aberto e o Orquestra informa que a branch não foi integrada.
- Dado um repositório cuja branch principal não pode ser identificada e uma branch com commits próprios, quando a pessoa usuária escolhe "fechar e excluir worktree e branch", então nada é excluído e o Orquestra informa que não conseguiu verificar o merge.
- Dado que a exclusão foi bloqueada, quando a pessoa usuária escolhe "só fechar o terminal", então o bloco sai da tela e o worktree e a branch continuam existindo.

### Terminais abertos por outro terminal

- Dado um terminal aberto, quando ele pede a abertura de um terminal em um worktree, então um novo terminal aparece na mesma sessão, aberto nesse worktree, com uma seta de comando do terminal que pediu para o novo.
- Dado um terminal aberto no Ubuntu, quando ele roda `git worktree add` e o comando dá certo, então um novo terminal aparece na mesma sessão, aberto nesse worktree, com o mesmo agente, o nome da branch e uma seta de comando do terminal que criou o worktree.
- Dado que já existe um terminal aberto em um worktree, quando outro terminal pede a abertura automática nesse worktree, então nenhum terminal novo é aberto.
- Dado um terminal aberto por outro terminal, quando a pessoa usuária usa os botões de abrir no VS Code e ✕, então eles funcionam como em qualquer outro terminal.
- Dado que um terminal criou um worktree por meio das skills, quando a pessoa usuária abre o formulário de novo terminal no mesmo projeto, então esse worktree aparece na lista.

### Setas

- Dado dois terminais na mesma sessão, quando a pessoa usuária cria pelo editor uma seta de comando e uma de dependência, então as duas aparecem com aparência diferente entre si e no sentido escolhido.
- Dado uma seta de dependência entre A (dependente) e B (responsável), quando ela é exibida, então aponta de A para B.
- Dado uma seta existente, quando a pessoa usuária muda o tipo pelo editor, então a seta passa a ter a aparência do novo tipo.
- Dado uma seta existente, inclusive uma criada automaticamente, quando a pessoa usuária a remove pelo editor, então ela some da tela e não volta ao reabrir a janela.
- Dado um terminal, quando a pessoa usuária tenta criar uma seta dele para ele mesmo, então a seta não é criada.
- Dado uma seta entre dois terminais, quando um deles é movido, então a seta acompanha o terminal.
- Dado uma seta ligada a um terminal, quando esse terminal é finalizado, então a seta some.
- Dado vários terminais e setas em uma sessão, quando a interface é recarregada ou a janela é reaberta, então terminais e setas voltam com posição, histórico, tipos e ligações preservados.

## Restrições

- O aplicativo roda em Ubuntu e Windows. No Ubuntu, a versão suportada é a mais recente (26.04 LTS no momento desta especificação).
- O aplicativo não pode aceitar conexões vindas da rede nem de sites abertos no navegador.
- A abertura de terminais a partir de outro terminal só pode ser feita a partir da própria máquina.
- Os terminais rodam com o usuário local; nenhuma funcionalidade nova pode expor terminais ou arquivos à rede.
- Senhas, chaves e tokens não podem ser gravados em arquivos versionados nem nos dados de sessão guardados pelo aplicativo.
- O Orquestra não faz commit, push nem merge.
- O Orquestra aceita qualquer nome de branch válido no Git; convenções de nome ficam nas skills usadas no maestro.
- O Orquestra nunca exclui worktree com alterações não commitadas nem branch com commits próprios sem merge confirmado na branch principal.
- Comportamentos atuais (tela infinita, status, sobrevivência a recarregamentos da interface, atalhos, notificações), exceto a organização em grade, o campo de comando inicial e a pasta pré-preenchida, permanecem.
- Git, VS Code e os CLIs do Claude e do Codex precisam estar instalados na máquina; o Orquestra não os instala.

## Decisões pendentes

Nenhuma decisão pendente.
