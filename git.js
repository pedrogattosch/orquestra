// Operações de Git usadas pelo Orquestra: listar worktrees e branches, criar worktrees
// e decidir se um worktree pode ser excluído sem perder trabalho.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(cwd, args) {
  try { return git(cwd, args); } catch { return null; }
}

const samePath = (a, b) => path.resolve(a) === path.resolve(b);

function parseWorktrees(porcelain) {
  const list = [];
  for (const block of porcelain.split(/\n\s*\n/)) {
    const wt = {};
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) wt.path = path.resolve(line.slice(9));
      else if (line.startsWith('branch ')) wt.branch = line.slice(7).replace(/^refs\/heads\//, '');
    }
    if (wt.path) list.push({ path: wt.path, branch: wt.branch || null });
  }
  return list;
}

/** Informações do repositório que contém `dir`, ou null se não for um repositório Git. */
function repoInfo(dir) {
  if (!fs.existsSync(dir) || tryGit(dir, ['rev-parse', '--is-inside-work-tree']) !== 'true') return null;
  const worktrees = parseWorktrees(git(dir, ['worktree', 'list', '--porcelain']));
  const main = worktrees[0]; // o git sempre lista a pasta original primeiro
  const branches = git(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split('\n').filter(Boolean);
  return {
    root: main.path,
    currentBranch: main.branch,
    top: path.resolve(git(dir, ['rev-parse', '--show-toplevel'])),
    worktrees: worktrees.slice(1),
    branches,
  };
}

function currentBranch(dir) {
  const b = tryGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return b && b !== 'HEAD' ? b : '';
}

/** O worktree (que não é a pasta original) em que `dir` está, ou null. */
function worktreeOf(dir) {
  const info = repoInfo(dir);
  if (!info) return null;
  const wt = info.worktrees.find((w) => samePath(w.path, info.top));
  return wt ? { root: info.root, path: wt.path, branch: wt.branch } : null;
}

/**
 * Cria (ou reaproveita) um worktree irmão da pasta original do repositório:
 *   /projetos/app  +  branch "login"  ->  /projetos/app-login
 * Uma branch nova parte da branch atual da pasta original.
 */
function ensureWorktree(dir, branch) {
  const info = repoInfo(dir);
  if (!info) throw new Error('A pasta não é um repositório Git.');
  try {
    git(info.root, ['check-ref-format', '--branch', branch]);
  } catch {
    throw new Error(`Nome de branch inválido: ${branch}`);
  }

  const folder = `${path.basename(info.root)}-${branch.replace(/[\\/:*?"<>| ]+/g, '-')}`;
  const target = path.join(path.dirname(info.root), folder);
  if (fs.existsSync(target)) return target; // já existe: só usa

  const args = info.branches.includes(branch)
    ? ['worktree', 'add', target, branch]
    : ['worktree', 'add', '-b', branch, target, info.currentBranch || 'HEAD'];
  git(info.root, args);
  return target;
}

/** Nome da branch principal do repositório (ex.: main ou master), ou null se não der para saber. */
function mainBranch(root) {
  const remote = tryGit(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (remote) return remote.replace(/^origin\//, '');
  for (const name of ['main', 'master']) {
    if (tryGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  }
  return null;
}

const isAncestor = (root, a, b) => tryGit(root, ['merge-base', '--is-ancestor', a, b]) !== null;

/**
 * Diz se o worktree em `dir` pode ser excluído junto com a branch sem perder trabalho:
 * sem alterações não commitadas e com a branch integrada na principal ou sem commits próprios.
 */
function checkDelete(dir) {
  const wt = worktreeOf(dir);
  if (!wt) return { ok: false, reasons: ['O terminal não está em um worktree.'] };

  const reasons = [];
  if (git(wt.path, ['status', '--porcelain'])) reasons.push('O worktree tem alterações não commitadas.');

  if (wt.branch) {
    const main = mainBranch(wt.root);
    const ref = `refs/heads/${wt.branch}`;
    const merged = main && (isAncestor(wt.root, ref, `refs/heads/${main}`)
      || isAncestor(wt.root, ref, `refs/remotes/origin/${main}`));
    // commits que só existem nesta branch (nenhuma outra branch local os contém)
    const own = Number(git(wt.root, ['rev-list', '--count', ref, '--not', `--exclude=${wt.branch}`, '--branches']));
    if (!merged && own > 0) {
      reasons.push(main
        ? `A branch ${wt.branch} tem commits sem merge na ${main}.`
        : `Não consegui identificar a branch principal para verificar o merge da ${wt.branch}.`);
    }
  }
  return { ok: reasons.length === 0, reasons, worktree: wt };
}

/** Exclui o worktree e a branch, somente se `checkDelete` permitir. */
function deleteWorktree(dir) {
  const check = checkDelete(dir);
  if (!check.ok) throw new Error(check.reasons.join(' '));
  const { root, path: wtPath, branch } = check.worktree;
  git(root, ['worktree', 'remove', wtPath]);
  if (branch) git(root, ['branch', '-D', branch]); // a verificação acima já garantiu que nada se perde
}

module.exports = { repoInfo, currentBranch, worktreeOf, ensureWorktree, mainBranch, checkDelete, deleteWorktree };
