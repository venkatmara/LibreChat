import { ModuleRegistry, parseModuleName } from './registry';

describe('ModuleRegistry', () => {
  it('defaults to mongo and resolves a registered module', async () => {
    const registry = new ModuleRegistry();
    registry.register({ name: 'mongo', health: async () => ({ ok: true, adapter: 'mongo' }) });
    const module = registry.resolve(undefined);
    expect(await module.health()).toEqual({ ok: true, adapter: 'mongo' });
  });

  it('rejects unknown module names', () => {
    expect(() => parseModuleName('sqlite')).toThrow(/Unknown PERSISTENCE_MODULE/);
  });

  it('rejects a module that is not registered', () => {
    expect(() => new ModuleRegistry().resolve('postgres')).toThrow(/not registered/);
  });
});
