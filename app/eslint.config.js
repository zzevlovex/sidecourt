import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  { ignores: ['build/', '.svelte-kit/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...svelte.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Reading a value on its own line is how effects here say "re-run when this changes".
      'no-unused-expressions': 'off',
      // Addresses here are built with resolve() plus a query, which this rule cannot follow.
      'svelte/no-navigation-without-resolve': 'off',
      // Sets and dates here are short-lived values, never shown as reactive state.
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
];
