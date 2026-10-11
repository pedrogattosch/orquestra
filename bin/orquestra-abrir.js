// Abre um novo terminal no Orquestra a partir de um terminal do próprio Orquestra.
// O novo terminal entra na mesma sessão e ganha uma seta de comando a partir deste.

const path = require('path');

const AJUDA = `Uso: orquestra-abrir --pasta <pasta> [--nome <nome>] [--agente claude|codex]

  --pasta   pasta ou worktree onde o terminal abre (relativa à pasta atual)
  --nome    nome do terminal (opcional; sem nome, o Orquestra cria um)
  --agente  agente iniciado no terminal (opcional; sem agente, abre só o shell)`;

function parse(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = { '--pasta': 'dir', '--nome': 'name', '--agente': 'agent' }[argv[i]];
    if (argv[i] === '--ajuda' || argv[i] === '-h' || argv[i] === '--help') return null;
    if (!key || argv[i + 1] === undefined) throw new Error(`Opção inválida: ${argv[i]}`);
    opts[key] = argv[++i];
  }
  return opts;
}

async function main() {
  const opts = parse(process.argv.slice(2));
  if (!opts) return console.log(AJUDA);
  if (!opts.dir) throw new Error(`Informe a pasta.\n\n${AJUDA}`);

  const { ORQUESTRA_URL, ORQUESTRA_TERMINAL_ID } = process.env;
  if (!ORQUESTRA_URL || !ORQUESTRA_TERMINAL_ID) throw new Error('Este comando só funciona dentro de um terminal do Orquestra.');

  const res = await fetch(`${ORQUESTRA_URL}/api/terminals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...opts, dir: path.resolve(opts.dir), parentId: ORQUESTRA_TERMINAL_ID }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
  console.log(`Terminal "${body.name}" aberto em ${body.cwd}`);
}

main().catch((err) => {
  console.error(`orquestra-abrir: ${err.message}`);
  process.exit(1);
});
