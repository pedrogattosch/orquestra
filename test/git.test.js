const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const g = require('../git');

Object.assign(process.env, {
  GIT_AUTHOR_NAME: 'teste', GIT_AUTHOR_EMAIL: 'teste@exemplo.com',
  GIT_COMMITTER_NAME: 'teste', GIT_COMMITTER_EMAIL: 'teste@exemplo.com',
});
// rodando num terminal do Orquestra, o git é o intermediário dele: sem isto, cada worktree
// criada pelos testes abriria um terminal de verdade no Orquestra
delete process.env.ORQUESTRA_URL;
delete process.env.ORQUESTRA_TERMINAL_ID;

const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function newRepo(branch = 'main') {
  // caminho completo: no Windows, a pasta temporária pode vir com nome curto (RUNNER~1), e o Git devolve o longo
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'orquestra-')));
  const root = path.join(base, 'app');
  fs.mkdirSync(root);
  run(root, 'init', '-q', '-b', branch);
  fs.writeFileSync(path.join(root, 'a.txt'), 'a');
  run(root, 'add', 'a.txt');
  run(root, 'commit', '-q', '-m', 'inicial');
  return root;
}

function commit(dir, file) {
  fs.writeFileSync(path.join(dir, file), file);
  run(dir, 'add', file);
  run(dir, 'commit', '-q', '-m', file);
}

test('repoInfo devolve null fora de um repositório', () => {
  assert.strictEqual(g.repoInfo(fs.mkdtempSync(path.join(os.tmpdir(), 'orquestra-'))), null);
});

test('cria worktree irmão com branch nova partindo da branch atual da pasta original', () => {
  const root = newRepo();
  run(root, 'checkout', '-q', '-b', 'dev');
  commit(root, 'dev.txt');
  const wt = g.ensureWorktree(root, 'feat/x');
  assert.strictEqual(wt, path.join(path.dirname(root), 'app-feat-x'));
  assert.strictEqual(run(wt, 'rev-parse', 'HEAD'), run(root, 'rev-parse', 'dev'));

  const info = g.repoInfo(root);
  assert.deepStrictEqual(info.worktrees.map((w) => w.branch), ['feat/x']);
  assert.ok(info.branches.includes('feat/x'));
  assert.strictEqual(info.currentBranch, 'dev');
});

test('cria branch nova partindo da branch de origem escolhida', () => {
  const root = newRepo();
  run(root, 'checkout', '-q', '-b', 'dev');
  commit(root, 'dev.txt');
  const info = g.repoInfo(root);
  assert.strictEqual(info.mainBranch, 'main');
  const wt = g.ensureWorktree(root, 'feat/x', { newBranch: true, base: info.mainBranch });
  assert.strictEqual(run(wt, 'rev-parse', 'HEAD'), run(root, 'rev-parse', 'main'));
  assert.throws(() => g.ensureWorktree(root, 'feat/y', { newBranch: true, base: 'nao-existe' }), /origem nao-existe não existe/);
});

test('cria worktree a partir de uma branch existente', () => {
  const root = newRepo();
  run(root, 'branch', 'tarefa');
  const wt = g.ensureWorktree(root, 'tarefa', { newBranch: false });
  assert.strictEqual(run(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'tarefa');
});

test('recusa branch nova com nome já existente e branch existente que não existe', () => {
  const root = newRepo();
  run(root, 'branch', 'tarefa');
  assert.throws(() => g.ensureWorktree(root, 'tarefa', { newBranch: true }), /já existe/);
  assert.throws(() => g.ensureWorktree(root, 'outra', { newBranch: false }), /não existe/);
  assert.deepStrictEqual(g.repoInfo(root).worktrees, []);
});

test('cria worktree com o nome de pasta escolhido', () => {
  const root = newRepo();
  const wt = g.ensureWorktree(root, 'feat/x', { newBranch: true, folder: 'minha tarefa' });
  assert.strictEqual(wt, path.join(path.dirname(root), 'minha-tarefa'));
  assert.strictEqual(run(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/x');
});

test('recusa nome de worktree que já existe ou inválido', () => {
  const root = newRepo();
  fs.mkdirSync(path.join(path.dirname(root), 'ocupada'));
  assert.throws(() => g.ensureWorktree(root, 'a', { folder: 'ocupada' }), /já existe/);
  assert.throws(() => g.ensureWorktree(root, 'b', { folder: '..' }), /inválido/);
  assert.deepStrictEqual(g.repoInfo(root).worktrees, []);
});

test('recusa nome de branch inválido', () => {
  assert.throws(() => g.ensureWorktree(newRepo(), 'a..b'), /inválido/);
});

test('branch sem commits próprios e sem alterações pode ser excluída', () => {
  const root = newRepo();
  const wt = g.ensureWorktree(root, 'tarefa');
  assert.deepStrictEqual(g.checkDelete(wt).reasons, []);
  g.deleteWorktree(wt);
  assert.ok(!fs.existsSync(wt));
  assert.ok(!g.repoInfo(root).branches.includes('tarefa'));
});

test('bloqueia exclusão com alterações não commitadas', () => {
  const wt = g.ensureWorktree(newRepo(), 'tarefa');
  fs.writeFileSync(path.join(wt, 'novo.txt'), 'x');
  const r = g.checkDelete(wt);
  assert.strictEqual(r.ok, false);
  assert.match(r.reasons.join(), /não commitadas/);
  assert.throws(() => g.deleteWorktree(wt));
  assert.ok(fs.existsSync(wt));
});

test('bloqueia branch com commits sem merge e libera depois do merge', () => {
  const root = newRepo();
  const wt = g.ensureWorktree(root, 'tarefa');
  commit(wt, 'b.txt');
  assert.match(g.checkDelete(wt).reasons.join(), /sem merge na main/);
  run(root, 'merge', '-q', '--no-ff', '-m', 'merge', 'tarefa');
  assert.strictEqual(g.checkDelete(wt).ok, true);
});

test('usa master quando é a branch principal', () => {
  const root = newRepo('master');
  assert.strictEqual(g.mainBranch(root), 'master');
  const wt = g.ensureWorktree(root, 'tarefa');
  commit(wt, 'b.txt');
  assert.match(g.checkDelete(wt).reasons.join(), /sem merge na master/);
  run(root, 'merge', '-q', 'tarefa');
  assert.strictEqual(g.checkDelete(wt).ok, true);
});

test('sem branch principal identificável, bloqueia branch com commits próprios', () => {
  const root = newRepo('trunk');
  assert.strictEqual(g.mainBranch(root), null);
  const wt = g.ensureWorktree(root, 'tarefa');
  assert.strictEqual(g.checkDelete(wt).ok, true);
  commit(wt, 'b.txt');
  assert.match(g.checkDelete(wt).reasons.join(), /Não consegui identificar/);
});

test('a pasta original não é tratada como worktree', () => {
  const root = newRepo();
  assert.strictEqual(g.worktreeOf(root), null);
  assert.strictEqual(g.checkDelete(root).ok, false);
});

test('headFile aponta para o HEAD da pasta original e de cada worktree', () => {
  const root = newRepo();
  const wt = g.ensureWorktree(root, 'tarefa');
  fs.mkdirSync(path.join(root, 'sub'));
  assert.strictEqual(g.headFile(root), path.join(root, '.git', 'HEAD'));
  assert.strictEqual(g.headFile(path.join(root, 'sub')), path.join(root, '.git', 'HEAD'));
  assert.match(fs.readFileSync(g.headFile(wt), 'utf8'), /refs\/heads\/tarefa/);
  assert.strictEqual(g.headFile(fs.mkdtempSync(path.join(os.tmpdir(), 'orquestra-'))), null);
});
