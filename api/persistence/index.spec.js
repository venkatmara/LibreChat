const logs = [];
const built = [];

jest.mock('@librechat/data-schemas', () => ({
  logger: { info: (m) => logs.push(m), error: jest.fn(), warn: jest.fn() },
}));

const { ModuleRegistry } = jest.requireActual('@lcmig/persistence-core');
jest.mock('@lcmig/persistence-mongo', () => ({
  createMongoModule: jest.fn(() => {
    built.push('mongo');
    return { name: 'mongo', users: {}, health: jest.fn(), close: jest.fn() };
  }),
}));
jest.mock('@lcmig/persistence-postgres', () => ({
  createPostgresModule: jest.fn((cfg) => {
    built.push('postgres');
    if (!cfg.databaseUrl) throw new Error('DATABASE_URL is required for PERSISTENCE_MODULE=postgres');
    return { name: 'postgres', users: {}, health: jest.fn(), close: jest.fn() };
  }),
}));

const { initPersistence, getPersistence, resetPersistence } = require('./index');

const mongoose = { connection: {}, models: { User: {} } };

describe('api persistence composition root', () => {
  beforeEach(() => {
    logs.length = 0;
    built.length = 0;
    resetPersistence();
  });

  it('TC-4: PERSISTENCE_MODULE=mongo builds only the mongo adapter', async () => {
    const m = await initPersistence({ env: { PERSISTENCE_MODULE: 'mongo' }, mongoose });
    expect(m.name).toBe('mongo');
    expect(built).toEqual(['mongo']);
    expect(logs).toContain('[persistence] adapter=mongo source=env');
  });

  it('TC-5: PERSISTENCE_MODULE=postgres builds only the postgres adapter', async () => {
    const m = await initPersistence({
      env: { PERSISTENCE_MODULE: 'postgres', DATABASE_URL: 'postgres://u:p@h/db' },
      mongoose,
    });
    expect(m.name).toBe('postgres');
    expect(built).toEqual(['postgres']);
    expect(logs).toContain('[persistence] adapter=postgres source=env');
  });

  it('TC-6: unset or empty defaults to mongo and is logged', async () => {
    for (const value of [undefined, '']) {
      resetPersistence();
      logs.length = 0;
      const m = await initPersistence({ env: { PERSISTENCE_MODULE: value }, mongoose });
      expect(m.name).toBe('mongo');
      expect(logs).toContain('[persistence] adapter=mongo source=default');
    }
  });

  it('TC-7: unsupported value fails startup, deterministically, building nothing', async () => {
    for (let i = 0; i < 2; i++) {
      await expect(
        initPersistence({ env: { PERSISTENCE_MODULE: 'mysql' }, mongoose }),
      ).rejects.toThrow(/mongo, postgres/);
    }
    expect(built).toEqual([]);
    expect(() => getPersistence()).toThrow(/not initialised/);
  });

  it('TC-30: postgres without DATABASE_URL fails fast', async () => {
    await expect(
      initPersistence({ env: { PERSISTENCE_MODULE: 'postgres' }, mongoose }),
    ).rejects.toThrow(/DATABASE_URL is required/);
  });

  it('keeps the registry class from persistence-core', () => {
    expect(typeof ModuleRegistry).toBe('function');
  });
});
