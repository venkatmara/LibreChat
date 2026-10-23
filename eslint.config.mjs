import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const restrictedDbImports = {
  paths: [
    {
      name: 'mongoose',
      message: 'Use persistence ports; Mongo access lives in packages/persistence-mongo (NFR-1).',
    },
    {
      name: 'mongodb',
      message: 'Use persistence ports; Mongo access lives in packages/persistence-mongo (NFR-1).',
    },
  ],
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { 'no-restricted-imports': ['error', restrictedDbImports] } },
  // Mongo driver imports are allowed only inside the Mongo adapter and the migration CLI (extract stage).
  {
    files: ['packages/persistence-mongo/**', 'packages/lcmig/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { globals: { module: 'writable' } } },
);
