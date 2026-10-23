import { clearRegistry, createPersistence, registerPersistence } from './registry';

describe('persistence registry', () => {
  beforeEach(clearRegistry);

  it('creates the registered adapter by name', async () => {
    registerPersistence('fake', () => ({
      name: 'fake',
      health: async () => ({ adapter: 'fake', ok: true }),
      close: async () => undefined,
    }));
    const p = await createPersistence('fake');
    expect(await p.health()).toEqual({ adapter: 'fake', ok: true });
  });

  it('rejects an unknown module with a clear error', async () => {
    await expect(createPersistence('nope')).rejects.toThrow(/Unknown PERSISTENCE_MODULE "nope"/);
  });
});
