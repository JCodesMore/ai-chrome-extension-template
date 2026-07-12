import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const MAX_FILE_LINES = 500;
const MAX_NESTING_DEPTH = 4;
const TRIVIAL_NUMBERS = [-1, 0, 1, 2];

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '.dev-profile/', '.browser/', 'release/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: TRIVIAL_NUMBERS, ignoreArrayIndexes: true, enforceConst: true },
      ],
      'max-lines': ['error', { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', MAX_NESTING_DEPTH],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    // Dev-loop scripts: plain Node ESM, looser by design (ports/timeouts inline is fine).
    files: ['tools/**/*.mjs', 'scripts/**/*.mjs', '*.mjs', '*.config.ts'],
    languageOptions: { globals: { ...globals.node, WebSocket: 'readonly' } },
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
);
