import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...sveltePlugin.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.ts', '**/*.svelte'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        extraFileExtensions: ['.svelte']
      },
      globals: { ...globals.browser }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tsParser },
      globals: { ...globals.browser }
    }
  },
  {
    // Node-executed config/tooling files, not part of the browser bundle.
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    // Runs in a ServiceWorkerGlobalScope, not the DOM (`caches`, `clients`,
    // `skipWaiting`… aren't part of `globals.browser`). See
    // src/service-worker.ts's own header comment for what this file does.
    files: ['src/service-worker.ts'],
    languageOptions: { globals: { ...globals.serviceworker } }
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/', 'node_modules/', 'coverage/']
  }
];
