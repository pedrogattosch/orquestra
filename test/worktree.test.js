const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { worktreePath } = require('../bin/orquestra-worktree');

const cwd = path.resolve('/projetos/app');
const wt = (...args) => worktreePath(args, cwd);

test('acha a pasta de um git worktree add simples', () => {
  assert.strictEqual(wt('worktree', 'add', '../app-tarefa'), path.resolve('/projetos/app-tarefa'));
});

test('pula as opções do worktree add, inclusive as que recebem valor', () => {
  assert.strictEqual(wt('worktree', 'add', '-b', 'feat/x', '../app-x', 'origin/main'), path.resolve('/projetos/app-x'));
  assert.strictEqual(wt('worktree', 'add', '--lock', '--reason', 'pq', '-f', '/tmp/wt'), path.resolve('/tmp/wt'));
  assert.strictEqual(wt('worktree', 'add', '--', '-pasta-com-traco'), path.resolve('/projetos/app/-pasta-com-traco'));
});

test('considera as opções globais do git, como -C e -c', () => {
  assert.strictEqual(wt('-C', 'sub', 'worktree', 'add', 'wt'), path.resolve('/projetos/app/sub/wt'));
  assert.strictEqual(wt('-c', 'core.x=1', '--no-pager', 'worktree', 'add', '../w'), path.resolve('/projetos/w'));
});

test('ignora o que não é worktree add', () => {
  assert.strictEqual(wt('status'), null);
  assert.strictEqual(wt('worktree', 'list'), null);
  assert.strictEqual(wt('worktree', 'remove', '../app-x'), null);
  assert.strictEqual(wt('commit', '-m', 'worktree add'), null);
  assert.strictEqual(wt('worktree', 'add'), null);
});
