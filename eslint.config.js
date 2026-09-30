import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Pragmatic baseline: catches real bugs (undefined vars, unreachable code, hooks misuse) without forcing
// a mass rewrite of the existing code base. Tighten rules gradually.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'data/**', 'public/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['server/**/*.ts', 'server.ts', 'vite.config.ts', 'eslint.config.js', 'src/tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'off',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
    },
  }
);
