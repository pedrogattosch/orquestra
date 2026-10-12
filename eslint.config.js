const js = require('@eslint/js');
const globals = require('globals');
const html = require('eslint-plugin-html');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }], // falhas sem importância são ignoradas de propósito
      'no-unused-vars': ['error', { ignoreRestSiblings: true }], // tirar campos de um objeto com ...rest
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['**/*.html'],
    plugins: { html },
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, Terminal: 'readonly', FitAddon: 'readonly' } },
  },
];
