// Orquestra — servidor local que abre terminais reais e os entrega ao navegador.
// Cada terminal é uma sessão node-pty que continua viva se você recarregar a página.

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const express = require('express');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const PORT = Number(process.env.PORT) || 4321;
const HOST = '127.0.0.1'; // só aceita conexões da sua própria máquina
const MAX_BUFFER = 200 * 1024; // quanto de saída guardar para reexibir ao reconectar

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/xterm', express.static(path.join(__dirname, 'node_modules/@xterm/xterm')));
app.use('/vendor/addon-fit', express.static(path.join(__dirname, 'node_modules/@xterm/addon-fit')));

/** id -> { pty, buffer, clients:Set, info } */
const sessions = new Map();

function defaultShell() {
  if (process.platform === 'win32') return { file: 'powershell.exe', args: ['-NoLogo'] };
  return { file: process.env.SHELL || 'bash', args: ['-l'] };
}

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Cria (ou reaproveita) um worktree irmão da pasta do repositório:
 *   /projetos/app  +  branch "login"  ->  /projetos/app-login
 */
function ensureWorktree(repoDir, branch) {
  const root = git(repoDir, ['rev-parse', '--show-toplevel']);
  const folder = `${path.basename(root)}-${branch.replace(/[\\/:*?"<>| ]+/g, '-')}`;
  const target = path.join(path.dirname(root), folder);

  if (fs.existsSync(target)) return target; // já existe: só usa

  let branchExists = true;
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  } catch {
    branchExists = false;
  }
  const args = branchExists
    ? ['worktree', 'add', target, branch]
    : ['worktree', 'add', '-b', branch, target];
  git(root, args);
  return target;
}

function createSession(id, { cwd, cmd, branch, cols, rows }) {
  let dir = path.resolve(expandHome(cwd) || os.homedir());
  if (!fs.existsSync(dir)) throw new Error(`Pasta não encontrada: ${dir}`);

  let worktree = null;
  if (branch) {
    dir = ensureWorktree(dir, branch);
    worktree = dir;
  }

  const shell = defaultShell();
  const term = pty.spawn(shell.file, shell.args, {
    name: 'xterm-256color',
    cols: cols || 100,
    rows: rows || 30,
    cwd: dir,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });

  const session = { pty: term, buffer: '', clients: new Set(), info: { id, cwd: dir, worktree, cmd, branch } };

  term.onData((data) => {
    session.buffer += data;
    if (session.buffer.length > MAX_BUFFER) session.buffer = session.buffer.slice(-MAX_BUFFER);
    const msg = JSON.stringify({ t: 'out', d: data });
    for (const ws of session.clients) if (ws.readyState === 1) ws.send(msg);
  });

  term.onExit(({ exitCode }) => {
    const msg = JSON.stringify({ t: 'exit', code: exitCode });
    for (const ws of session.clients) if (ws.readyState === 1) ws.send(msg);
    if (sessions.get(id) === session) sessions.delete(id);
  });

  // Abre o shell e já dispara o agente dentro dele. Se o agente fechar, o terminal continua aberto.
  if (cmd && cmd.trim()) setTimeout(() => term.write(cmd.trim() + '\r'), 300);

  sessions.set(id, session);
  return session;
}

app.get('/api/defaults', (_req, res) => {
  res.json({ home: os.homedir(), cwd: process.cwd(), platform: process.platform });
});

app.get('/api/sessions', (_req, res) => {
  res.json([...sessions.values()].map((s) => s.info));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Protege contra sites maliciosos abrindo terminais na sua máquina pelo navegador.
function originAllowed(origin) {
  if (!origin) return true; // clientes fora do navegador
  try {
    const u = new URL(origin);
    return (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && Number(u.port) === PORT;
  } catch {
    return false;
  }
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/term' || !originAllowed(req.headers.origin)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, url));
});

wss.on('connection', (ws, url) => {
  const p = url.searchParams;
  const id = p.get('id');
  if (!id) return ws.close();

  let session = sessions.get(id);
  try {
    if (!session) {
      session = createSession(id, {
        cwd: p.get('cwd') || '',
        cmd: p.get('cmd') || '',
        branch: (p.get('branch') || '').trim(),
        cols: Number(p.get('cols')) || 100,
        rows: Number(p.get('rows')) || 30,
      });
    } else if (session.buffer) {
      ws.send(JSON.stringify({ t: 'out', d: session.buffer })); // reexibe o histórico
    }
  } catch (err) {
    const msg = (err.stderr && String(err.stderr).trim()) || err.message;
    ws.send(JSON.stringify({ t: 'error', d: msg }));
    return ws.close();
  }

  session.clients.add(ws);
  ws.send(JSON.stringify({ t: 'info', ...session.info }));

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'in' && typeof m.d === 'string') session.pty.write(m.d);
    else if (m.t === 'resize' && m.cols > 0 && m.rows > 0) {
      try { session.pty.resize(Math.floor(m.cols), Math.floor(m.rows)); } catch {}
    } else if (m.t === 'kill') {
      if (sessions.get(id) === session) sessions.delete(id);
      try { session.pty.kill(); } catch {}
    }
  });

  ws.on('close', () => session.clients.delete(ws));
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Orquestra rodando em http://localhost:${PORT}\n`);
});

function shutdown() {
  for (const s of sessions.values()) { try { s.pty.kill(); } catch {} }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
