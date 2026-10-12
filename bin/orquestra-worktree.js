// Chamado pelo intermediário do git (bin/shim/git) depois de um `git worktree add` que deu certo.
// Pede ao Orquestra um terminal na worktree nova, ligado ao terminal que rodou o comando.
// Nunca muda o resultado do git: avisos e erros vão para o stderr.

const path = require('path');

// opções globais do git que recebem o valor no argumento seguinte
const GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
// opções do `git worktree add` que recebem o valor no argumento seguinte
const ADD_WITH_VALUE = new Set(['-b', '-B', '--reason']);

/** A pasta da worktree criada por estes argumentos do git, ou null se não for um `git worktree add`. */
function worktreePath(args, cwd) {
  let i = 0;
  for (; i < args.length && args[i].startsWith('-'); i++) {
    if (args[i] === '-C') cwd = path.resolve(cwd, args[i + 1] || '');
    if (GLOBAL_WITH_VALUE.has(args[i])) i++;
  }
  if (args[i] !== 'worktree' || args[i + 1] !== 'add') return null;
  let onlyPositional = false;
  for (i += 2; i < args.length; i++) {
    const a = args[i];
    if (!onlyPositional && a === '--') { onlyPositional = true; continue; }
    if (!onlyPositional && a.startsWith('-')) {
      if (ADD_WITH_VALUE.has(a)) i++;
      continue;
    }
    return path.resolve(cwd, a);
  }
  return null;
}

async function main() {
  const dir = worktreePath(process.argv.slice(2), process.cwd());
  const { ORQUESTRA_URL, ORQUESTRA_TERMINAL_ID } = process.env;
  if (!dir || !ORQUESTRA_URL || !ORQUESTRA_TERMINAL_ID) return;
  const res = await fetch(`${ORQUESTRA_URL}/api/terminals/${ORQUESTRA_TERMINAL_ID}/worktree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  if (body.id) console.error(`Orquestra: terminal ${body.name ? `"${body.name}" ` : ''}aberto em ${body.cwd}`);
}

if (require.main === module) {
  main().catch((err) => console.error(`Orquestra: não consegui abrir o terminal da worktree (${err.message})`));
}

module.exports = { worktreePath };
