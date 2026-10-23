import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Tooling is scoped to LCMIG code: packages/lcmig and packages/persistence-*.
// The LibreChat api/ placeholder, docs and build output are not linted here.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'api/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      eqeqeq: 'error',
      // NFR-1 / G1: Mongo access only inside persistence-mongo (and lcmig, which extracts from Mongo).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['mongoose', 'mongodb', 'mongoose/*', 'mongodb/*'],
              message:
                'Use persistence ports; Mongo is allowed only in persistence-mongo and lcmig.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/persistence-mongo/**/*.ts', 'packages/lcmig/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { globals: { describe: 'readonly', it: 'readonly', expect: 'readonly' } },
  },
);
