// Flat config for the functions/ TypeScript codebase.
// Overrides the parent eslint.config.js (Vite client) — ESLint walks up
// the directory tree and uses the first flat config it finds.

import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  { ignores: ['lib/', 'node_modules/', '*.config.js'] },
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // TypeScript itself checks identifier validity at compile time, and
      // it also exposes ambient types like AbortSignal / HeadersInit /
      // FirebaseFirestore that ESLint's no-undef can't see. Defer to tsc.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
