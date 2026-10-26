/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@lcmig/persistence-core$': '<rootDir>/packages/persistence-core/src/index.ts',
    '^@lcmig/persistence-mongo$': '<rootDir>/packages/persistence-mongo/src/index.ts',
    '^@lcmig/persistence-postgres$': '<rootDir>/packages/persistence-postgres/src/index.ts',
  },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.check.json' }] },
};
