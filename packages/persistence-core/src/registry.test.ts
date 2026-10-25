import type { UserRepo } from './ports';
import type { PersistenceModule, PersistenceModuleName, RegistryLogEntry } from './registry';
import { ModuleRegistry, parseModuleName } from './registry';

const unusedUsers = {} as UserRepo;

function stub(name: PersistenceModuleName): PersistenceModule {
  return {
    name,
    users: unusedUsers,
    health: async () => ({ ok: true, adapter: name }),
    close: async () => undefined,
  };
}

function setup() {
  const logs: RegistryLogEntry[] = [];
  const built: PersistenceModuleName[] = [];
  const registry = new ModuleRegistry((entry) => logs.push(entry));
  for (const name of ['mongo', 'postgres'] as const) {
    registry.register(name, () => {
      built.push(name);
      return stub(name);
    });
  }
  return { registry, logs, built };
}

describe('ModuleRegistry', () => {
  it('TC-4 loads only the mongo adapter for PERSISTENCE_MODULE=mongo', async () => {
    const { registry, logs, built } = setup();
    const module = await registry.resolve('mongo');
    expect(module.name).toBe('mongo');
    expect(built).toEqual(['mongo']);
    expect(logs).toEqual([{ adapter: 'mongo', source: 'env' }]);
  });

  it('TC-5 loads only the postgres adapter for PERSISTENCE_MODULE=postgres', async () => {
    const { registry, logs, built } = setup();
    const module = await registry.resolve('postgres');
    expect(module.name).toBe('postgres');
    expect(built).toEqual(['postgres']);
    expect(logs).toEqual([{ adapter: 'postgres', source: 'env' }]);
  });

  it('TC-6 defaults unset or empty PERSISTENCE_MODULE to mongo and logs the source', async () => {
    for (const value of [undefined, '']) {
      const { registry, logs } = setup();
      const module = await registry.resolve(value);
      expect(module.name).toBe('mongo');
      expect(logs).toEqual([{ adapter: 'mongo', source: 'default' }]);
    }
  });

  it('TC-7 rejects an unsupported PERSISTENCE_MODULE without building an adapter', async () => {
    for (let i = 0; i < 2; i++) {
      const { registry, built } = setup();
      await expect(registry.resolve('mysql')).rejects.toThrow(/mongo, postgres/);
      expect(built).toEqual([]);
    }
    expect(() => parseModuleName('sqlite')).toThrow(/Unknown PERSISTENCE_MODULE/);
  });

  it('rejects a module that is not registered', async () => {
    await expect(new ModuleRegistry().resolve('postgres')).rejects.toThrow(/not registered/);
  });
});
