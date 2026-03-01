// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  eslint.configs.recommended,

  // Base TS rules (all TS files)
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: { ...globals.node, ...globals.jest },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      'no-unused-vars': 'off', // Disable base rule to use TypeScript version
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  // Test files
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // NestJS Controllers can use constructor injection with no-explicit-any
  {
    files: ['**/*.controller.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
