/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@lcmig/persistence-core$': '<rootDir>/packages/persistence-core/src/index.ts',
  },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.check.json' }] },
};
