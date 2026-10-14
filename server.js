// Orquestra — servidor local que abre terminais reais e os entrega à janela do aplicativo.
// Guarda sessões, terminais e setas em disco para restaurar o layout ao abrir de novo.

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const express = require('express');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const git = require('./git');

const MAX_BUFFER = 200 * 1024; // quanto de saída guardar para reexibir ao reconectar
const AGENTS = { claude: 'claude', codex: 'codex', gemini: 'gemini', antigravity: 'antigravity' };
const ARROW_TYPES = ['comando', 'dependencia'];
const NOTE_COLORS = ['tinta', 'azul', 'vermelho', 'verde', 'laranja'];
const NOTE_SIZE = { min: 14, max: 72, default: 26 };
const COLORS = ['#7c9cff', '#4ade80', '#f5b13d', '#f472b6', '#38bdf8', '#a78bfa', '#fb923c', '#2dd4bf'];

const uid = () => crypto.randomUUID();

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

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function isInside(p, dir) {
  const rel = path.relative(dir, path.resolve(p));
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

/**
 * Inicia o servidor em 127.0.0.1.
 * dataDir: onde salvar o estado; binDir: pasta com o comando orquestra-abrir;
 * nodePath: executável usado para rodar esse comando.
 */
function start({ dataDir, binDir, nodePath, port = 0 }) {
  const stateFile = path.join(dataDir, 'estado.json');
  const live = new Map(); // id do terminal -> { pty, buffer, clients:Set, exited }
  const eventClients = new Set();
  let warnings = [];
  let url = '';

  // ---------------------------------------------------------------- estado
  function load() {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; }
  }
  const state = load() || { activeSession: null, sessions: [] };

  let saveTimer = null;
  function saveNow() {
    clearTimeout(saveTimer); saveTimer = null;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2));
    fs.renameSync(stateFile + '.tmp', stateFile);
  }
  function changed() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, 300);
    const msg = JSON.stringify({ t: 'state', state: publicState() });
    for (const ws of eventClients) if (ws.readyState === 1) ws.send(msg);
  }

  function publicState() {
    return { ...state, live: Object.fromEntries([...live].map(([id, l]) => [id, !l.exited])) };
  }

  function newSession(name, project) {
    const used = new Set(state.sessions.map((s) => s.name));
    let n = state.sessions.length + 1;
    while (!name && used.has(`Sessão ${n}`)) n++;
    const s = { id: uid(), name: name || `Sessão ${n}`, view: { x: 0, y: 0, s: 1 }, terminals: [], arrows: [], notes: [] };
    if (project) s.project = project;
    state.sessions.push(s);
    return s;
  }

  const getSession = (id) => {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw new HttpError(404, 'Sessão não encontrada.');
    return s;
  };

  function findTerminal(id) {
    for (const session of state.sessions) {
      const term = session.terminals.find((t) => t.id === id);
      if (term) return { session, term };
    }
    throw new HttpError(404, 'Terminal não encontrado.');
  }

  function uniqueName(session, base) {
    const used = new Set(session.terminals.map((t) => t.name));
    let name = base, i = 2;
    while (used.has(name)) name = `${base} ${i++}`;
    return name;
  }

  // ---------------------------------------------------------------- terminais
  function spawnTerminal(cfg) {
    const shell = defaultShell();
    const win = process.platform === 'win32';
    const sep = win ? ';' : ':';
    // no Linux e no macOS, o intermediário do git (bin/shim) vem antes do git de verdade
    const bins = win ? binDir : path.join(binDir, 'shim') + sep + binDir;
    const term = pty.spawn(shell.file, shell.args, {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: cfg.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ORQUESTRA_URL: url,
        ORQUESTRA_TERMINAL_ID: cfg.id,
        ORQUESTRA_NODE: nodePath,
        PATH: bins + sep + (process.env.PATH || ''),
      },
    });

    const prev = live.get(cfg.id);
    const entry = { pty: term, buffer: '', clients: prev ? prev.clients : new Set(), exited: false };
    live.set(cfg.id, entry);

    term.onData((data) => {
      entry.buffer += data;
      if (entry.buffer.length > MAX_BUFFER) entry.buffer = entry.buffer.slice(-MAX_BUFFER);
      const msg = JSON.stringify({ t: 'out', d: data });
      for (const ws of entry.clients) if (ws.readyState === 1) ws.send(msg);
    });

    term.onExit(({ exitCode }) => {
      if (live.get(cfg.id) !== entry) return; // terminal reiniciado ou finalizado
      entry.exited = true;
      const msg = JSON.stringify({ t: 'exit', code: exitCode });
      for (const ws of entry.clients) if (ws.readyState === 1) ws.send(msg);
      changed();
    });

    // Abre o shell e já dispara o agente dentro dele. Se o agente fechar, o terminal continua aberto.
    if (AGENTS[cfg.agent]) setTimeout(() => term.write(AGENTS[cfg.agent] + '\r'), 300);
    return entry;
  }

  // Troca de branch dentro do terminal (git checkout, git switch): o arquivo HEAD muda e a branch
  // mostrada acompanha; o nome também, se ele for o da branch. watchFile compara pelo caminho, então
  // continua valendo quando o git substitui o arquivo.
  const branchWatch = new Map(); // id do terminal -> { file, listener }

  function updateBranch(cfg) {
    const branch = git.currentBranch(cfg.cwd);
    if (branch === cfg.branch) return;
    if (cfg.name && cfg.name === cfg.branch && branch) cfg.name = branch;
    cfg.branch = branch;
    changed();
  }

  function watchBranch(cfg) {
    const file = git.headFile(cfg.cwd);
    if (!file) return;
    const listener = () => updateBranch(cfg);
    fs.watchFile(file, { interval: 1000 }, listener);
    branchWatch.set(cfg.id, { file, listener });
    updateBranch(cfg); // ao restaurar, a branch pode ter mudado com o Orquestra fechado
  }

  function unwatchBranch(id) {
    const w = branchWatch.get(id);
    if (w) fs.unwatchFile(w.file, w.listener);
    branchWatch.delete(id);
  }

  function killTerminal(id) {
    const entry = live.get(id);
    live.delete(id);
    if (!entry || entry.exited) return Promise.resolve();
    return new Promise((resolve) => {
      entry.pty.onExit(() => resolve());
      try { entry.pty.kill(); } catch { resolve(); }
      setTimeout(resolve, 2000); // não espera para sempre por um processo teimoso
    });
  }

  function createTerminal(body) {
    const dir = path.resolve(expandHome(String(body.dir || '').trim()) || '.');
    if (!String(body.dir || '').trim() || !isDir(dir)) throw new HttpError(400, `Pasta não encontrada: ${dir}`);
    const agent = body.agent || '';
    if (agent && !AGENTS[agent]) throw new HttpError(400, `Agente desconhecido: ${agent}`);

    let parent = null;
    if (body.parentId) parent = findTerminal(body.parentId);
    const session = parent ? parent.session : getSession(body.sessionId || state.activeSession);

    let cwd = dir;
    if (body.worktreeBranch) {
      try {
        const newBranch = typeof body.newBranch === 'boolean' ? body.newBranch : undefined;
        const folder = String(body.worktreeName || '').trim() || undefined;
        const base = String(body.baseBranch || '').trim() || undefined;
        cwd = git.ensureWorktree(dir, String(body.worktreeBranch).trim(), { newBranch, folder, base });
      } catch (err) {
        throw new HttpError(400, (err.stderr && String(err.stderr).trim()) || err.message);
      }
    }
    const branch = git.currentBranch(cwd);

    const w = 720, h = 440;
    let { x, y } = body;
    if (parent) {
      // à direita de quem pediu, numa grade de 3 colunas preenchida linha a linha: o primeiro espaço
      // livre sem outro terminal, para os terminais ficarem espalhados e não numa fila para baixo
      const p = parent.term, gap = 40, cols = 3;
      const hits = (t) => x < t.x + t.w + gap && x + w + gap > t.x && y < t.y + t.h + gap && y + h + gap > t.y;
      for (let i = 0; ; i++) {
        x = p.x + p.w + 80 + (i % cols) * (w + gap);
        y = p.y + Math.floor(i / cols) * (h + gap);
        if (!session.terminals.some(hits)) break;
      }
    }
    const name = String(body.name || '').trim();
    const cfg = {
      id: uid(),
      name: name ? uniqueName(session, name) : '',
      cwd,
      branch,
      agent,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      w,
      h,
      color: COLORS[session.terminals.length % COLORS.length],
    };
    session.terminals.push(cfg);
    // numa sessão sem projeto (a primeira do aplicativo ou uma salva antes), a pasta do primeiro terminal vira o
    // projeto dela (project: pasta digitada, que difere de dir quando se escolhe um worktree existente)
    if (!parent && !session.project) session.project = path.resolve(expandHome(String(body.project || body.dir).trim()));
    if (parent) session.arrows.push({ id: uid(), from: parent.term.id, to: cfg.id, type: 'comando' });
    spawnTerminal(cfg);
    watchBranch(cfg);
    changed();
    return cfg;
  }

  // Restaura as sessões salvas: cada terminal ganha um shell novo na mesma pasta, com o mesmo agente.
  function restore() {
    for (const session of state.sessions) {
      session.terminals = session.terminals.filter((t) => {
        if (isDir(t.cwd)) return true;
        warnings.push(`"${t.name || t.cwd}" não foi restaurado: a pasta ${t.cwd} não existe mais.`);
        return false;
      });
      session.notes = (session.notes || []).map(upgradeNote);
      const ids = new Set(session.terminals.map((t) => t.id));
      session.arrows = session.arrows.filter((a) => ids.has(a.from) && ids.has(a.to));
      for (const t of session.terminals) { spawnTerminal(t); watchBranch(t); }
    }
    if (!state.sessions.length) newSession();
    if (!state.sessions.some((s) => s.id === state.activeSession)) state.activeSession = state.sessions[0].id;
    changed();
  }

  function openInVSCode(dir) {
    return new Promise((resolve, reject) => {
      const win = process.platform === 'win32';
      const child = spawn('code', [win ? `"${dir}"` : dir], { detached: true, stdio: 'ignore', shell: win });
      const fail = () => reject(new HttpError(500, 'Não consegui abrir o VS Code. Verifique se o comando "code" está instalado.'));
      child.on('error', fail);
      child.on('exit', (code) => (code === 0 ? resolve() : fail()));
      setTimeout(resolve, 5000); // o VS Code às vezes continua rodando no mesmo processo
      child.unref();
    });
  }

  // ---------------------------------------------------------------- HTTP
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Só aceita pedidos desta máquina e da própria janela do Orquestra (nunca de sites no navegador).
  function requestAllowed(req) {
    const { port: p } = server.address();
    const hosts = [`127.0.0.1:${p}`, `localhost:${p}`];
    if (!hosts.includes(req.headers.host)) return false;
    const origin = req.headers.origin;
    return !origin || hosts.some((h) => origin === `http://${h}`);
  }

  app.use((req, res, next) => (requestAllowed(req) ? next() : res.status(403).end()));
  app.use(express.json({ limit: '5mb' })); // anotações com textos grandes colados
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/icon.png', (req, res) => res.sendFile(path.join(__dirname, 'build', 'icon.png')));
  app.use('/vendor/xterm', express.static(path.dirname(require.resolve('@xterm/xterm/package.json'))));
  app.use('/vendor/addon-fit', express.static(path.dirname(require.resolve('@xterm/addon-fit/package.json'))));

  const route = (fn) => async (req, res) => {
    try {
      res.json((await fn(req)) || { ok: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message, ...(err.extra || {}) });
    }
  };

  app.get('/api/defaults', route(() => ({ home: os.homedir(), platform: process.platform })));
  app.get('/api/state', route(() => publicState()));

  app.get('/api/git', route((req) => {
    const dir = path.resolve(expandHome(String(req.query.dir || '')));
    if (!req.query.dir || !isDir(dir)) return { exists: false };
    return { exists: true, dir, repo: git.repoInfo(dir) };
  }));

  app.post('/api/sessions', route((req) => {
    const raw = String(req.body.project || '').trim();
    const project = raw && path.resolve(expandHome(raw));
    if (raw && !isDir(project)) throw new HttpError(400, `Pasta não encontrada: ${project}`);
    const s = newSession(project && path.basename(project), project);
    state.activeSession = s.id;
    changed();
    return s;
  }));

  app.patch('/api/sessions/:id', route((req) => {
    const s = getSession(req.params.id);
    if (typeof req.body.name === 'string' && req.body.name.trim()) s.name = req.body.name.trim();
    if (req.body.view) s.view = { x: +req.body.view.x || 0, y: +req.body.view.y || 0, s: +req.body.view.s || 1 };
    if (typeof req.body.project === 'string' && req.body.project.trim()) {
      const project = path.resolve(expandHome(req.body.project.trim()));
      if (!isDir(project)) throw new HttpError(400, `Pasta não encontrada: ${project}`);
      s.project = project;
    }
    changed();
  }));

  app.delete('/api/sessions/:id', route((req) => {
    const s = getSession(req.params.id);
    if (s.terminals.length) {
      const n = s.terminals.length;
      throw new HttpError(409, `Finalize ${n === 1 ? 'o terminal' : `os ${n} terminais`} desta sessão antes de fechá-la.`);
    }
    if (state.sessions.length === 1) throw new HttpError(409, 'Esta é a única sessão.');
    state.sessions = state.sessions.filter((x) => x !== s);
    if (state.activeSession === s.id) state.activeSession = state.sessions[0].id;
    changed();
  }));

  app.put('/api/active', route((req) => {
    state.activeSession = getSession(req.body.id).id;
    changed();
  }));

  app.post('/api/terminals', route((req) => createTerminal(req.body)));

  // Aviso do intermediário do git: este terminal criou uma worktree. Abre um terminal nela,
  // ligado a quem criou e com o mesmo agente, a menos que já exista um terminal ali.
  app.post('/api/terminals/:id/worktree', route((req) => {
    const { term } = findTerminal(req.params.id);
    const raw = String((req.body && req.body.dir) || '').trim();
    if (!raw) throw new HttpError(400, 'Informe a pasta da worktree.');
    const dir = path.resolve(raw);
    if (state.sessions.some((s) => s.terminals.some((t) => path.resolve(t.cwd) === dir))) return { skipped: true };
    return createTerminal({ dir, parentId: term.id, agent: term.agent, name: git.currentBranch(dir) || path.basename(dir) });
  }));

  // Print colado com Ctrl+V: salva a imagem num arquivo temporário e devolve o caminho,
  // que a janela cola no terminal como se a imagem tivesse sido arrastada para ele.
  const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  app.post('/api/terminals/:id/print', express.raw({ type: 'image/*', limit: '25mb' }), route((req) => {
    findTerminal(req.params.id);
    const ext = IMAGE_EXT[req.headers['content-type']];
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Imagem inválida.');
    const dir = path.join(os.tmpdir(), 'orquestra-prints');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `print-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`);
    fs.writeFileSync(file, req.body);
    return { path: file };
  }));

  app.patch('/api/terminals/:id', route((req) => {
    const { term } = findTerminal(req.params.id);
    const b = req.body;
    if (typeof b.name === 'string' && b.name.trim()) term.name = b.name.trim();
    for (const k of ['x', 'y']) if (Number.isFinite(b[k])) term[k] = Math.round(b[k]);
    if (Number.isFinite(b.w)) term.w = Math.max(320, Math.round(b.w));
    if (Number.isFinite(b.h)) term.h = Math.max(200, Math.round(b.h));
    changed();
  }));

  app.post('/api/terminals/:id/restart', route(async (req) => {
    const { term } = findTerminal(req.params.id);
    const entry = live.get(term.id);
    if (entry && !entry.exited) {
      entry.exited = true; // o onExit do processo antigo não deve marcar o novo como encerrado
      try { entry.pty.kill(); } catch {}
    }
    spawnTerminal(term);
    changed();
  }));

  app.post('/api/terminals/:id/vscode', route(async (req) => {
    await openInVSCode(findTerminal(req.params.id).term.cwd);
  }));

  app.get('/api/terminals/:id/finish-info', route((req) => {
    const wt = git.worktreeOf(findTerminal(req.params.id).term.cwd);
    return { worktree: wt ? wt.path : null, branch: wt ? wt.branch : null };
  }));

  app.post('/api/terminals/:id/finish', route(async (req) => {
    const { session, term } = findTerminal(req.params.id);
    if (req.body.deleteWorktree) {
      const check = git.checkDelete(term.cwd);
      const others = state.sessions.flatMap((s) => s.terminals)
        .filter((t) => t !== term && check.worktree && isInside(t.cwd, check.worktree.path));
      if (others.length) check.reasons.push(`Outro terminal ainda está aberto neste worktree: ${others.map((t) => t.name || t.cwd).join(', ')}.`);
      if (check.reasons.length) throw new HttpError(409, check.reasons.join(' '), { reasons: check.reasons });
    }
    await killTerminal(term.id);
    unwatchBranch(term.id);
    session.terminals = session.terminals.filter((t) => t !== term);
    session.arrows = session.arrows.filter((a) => a.from !== term.id && a.to !== term.id);
    changed();
    if (req.body.deleteWorktree) {
      try {
        git.deleteWorktree(term.cwd);
      } catch (err) {
        throw new HttpError(500, `O terminal foi fechado, mas não consegui excluir o worktree: ${(err.stderr && String(err.stderr).trim()) || err.message}`);
      }
    }
  }));

  app.post('/api/arrows', route((req) => {
    const { from, to, type } = req.body;
    if (!ARROW_TYPES.includes(type)) throw new HttpError(400, 'Tipo de seta inválido.');
    if (from === to) throw new HttpError(400, 'Uma seta precisa ligar dois terminais diferentes.');
    const a = findTerminal(from), b = findTerminal(to);
    if (a.session !== b.session) throw new HttpError(400, 'Setas só ligam terminais da mesma sessão.');
    const arrow = { id: uid(), from, to, type };
    a.session.arrows.push(arrow);
    changed();
    return arrow;
  }));

  function findArrow(id) {
    for (const session of state.sessions) {
      const arrow = session.arrows.find((a) => a.id === id);
      if (arrow) return { session, arrow };
    }
    throw new HttpError(404, 'Seta não encontrada.');
  }

  app.patch('/api/arrows/:id', route((req) => {
    if (!ARROW_TYPES.includes(req.body.type)) throw new HttpError(400, 'Tipo de seta inválido.');
    findArrow(req.params.id).arrow.type = req.body.type;
    changed();
  }));

  app.delete('/api/arrows/:id', route((req) => {
    const { session, arrow } = findArrow(req.params.id);
    session.arrows = session.arrows.filter((a) => a !== arrow);
    changed();
  }));

  // ---------------------------------------------------------------- anotações
  function findNote(id) {
    for (const session of state.sessions) {
      const note = session.notes.find((n) => n.id === id);
      if (note) return { session, note };
    }
    throw new HttpError(404, 'Anotação não encontrada.');
  }

  const noteSize = (v, fallback) => (Number.isFinite(v) ? Math.min(NOTE_SIZE.max, Math.max(NOTE_SIZE.min, Math.round(v))) : fallback);
  const noteColor = (v, fallback) => (NOTE_COLORS.includes(v) ? v : fallback);

  // size e color são o estilo de quem começa a escrever; cada trecho (run) do texto tem o seu
  function setNoteStyle(note, b) {
    note.size = noteSize(b.size, note.size);
    note.color = noteColor(b.color, note.color);
    if (Array.isArray(b.runs)) {
      note.runs = b.runs.slice(0, 2000)
        .filter((r) => r && typeof r.t === 'string' && r.t)
        .map((r) => ({ t: r.t.slice(0, 20000), size: noteSize(r.size, note.size), color: noteColor(r.color, note.color) }));
    }
  }

  // anotações salvas antes dos trechos guardavam só o texto, com um estilo para tudo
  function upgradeNote(note) {
    if (note.runs) return note;
    const { text, w, h, ...rest } = note;
    return { ...rest, runs: text ? [{ t: text, size: note.size || NOTE_SIZE.default, color: note.color || NOTE_COLORS[0] }] : [] };
  }

  app.post('/api/notes', route((req) => {
    const session = getSession(req.body.sessionId || state.activeSession);
    const note = {
      id: uid(),
      x: Math.round(Number(req.body.x) || 0),
      y: Math.round(Number(req.body.y) || 0),
      runs: [],
      size: NOTE_SIZE.default,
      color: NOTE_COLORS[0],
    };
    setNoteStyle(note, req.body);
    session.notes.push(note);
    changed();
    return note;
  }));

  app.patch('/api/notes/:id', route((req) => {
    const { note } = findNote(req.params.id);
    const b = req.body;
    for (const k of ['x', 'y']) if (Number.isFinite(b[k])) note[k] = Math.round(b[k]);
    setNoteStyle(note, b);
    changed();
  }));

  app.delete('/api/notes/:id', route((req) => {
    const { session, note } = findNote(req.params.id);
    session.notes = session.notes.filter((n) => n !== note);
    changed();
  }));

  // ---------------------------------------------------------------- WebSocket
  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, 'http://localhost');
    if (!['/term', '/events'].includes(u.pathname) || !requestAllowed(req)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => (u.pathname === '/events' ? onEvents(ws) : onTerm(ws, u)));
  });

  function onEvents(ws) {
    eventClients.add(ws);
    ws.send(JSON.stringify({ t: 'state', state: publicState() }));
    if (warnings.length) {
      ws.send(JSON.stringify({ t: 'warn', msgs: warnings }));
      warnings = [];
    }
    ws.on('close', () => eventClients.delete(ws));
  }

  function onTerm(ws, u) {
    const entry = live.get(u.searchParams.get('id'));
    if (!entry) {
      ws.send(JSON.stringify({ t: 'exit', code: null }));
      return ws.close();
    }
    if (entry.buffer) ws.send(JSON.stringify({ t: 'out', d: entry.buffer })); // reexibe o histórico
    if (entry.exited) ws.send(JSON.stringify({ t: 'exit', code: null }));
    entry.clients.add(ws);

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      const cur = live.get(u.searchParams.get('id'));
      if (!cur || cur.exited) return;
      if (m.t === 'in' && typeof m.d === 'string') cur.pty.write(m.d);
      else if (m.t === 'resize' && m.cols > 0 && m.rows > 0) {
        try { cur.pty.resize(Math.floor(m.cols), Math.floor(m.rows)); } catch {}
      }
    });
    ws.on('close', () => entry.clients.delete(ws));
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      url = `http://127.0.0.1:${server.address().port}`;
      restore();
      resolve({
        url,
        liveCount: () => [...live.values()].filter((l) => !l.exited).length,
        shutdown() {
          for (const l of live.values()) { try { l.pty.kill(); } catch {} }
          saveNow();
        },
      });
    });
  });
}

module.exports = { start };
