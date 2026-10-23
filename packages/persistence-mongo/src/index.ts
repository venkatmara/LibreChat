import { Persistence, registerPersistence } from '@lcmig/persistence-core';

export function createMongoPersistence(): Persistence {
  return {
    name: 'mongo',
    health: async () => ({ adapter: 'mongo', ok: true }),
    close: async () => undefined,
  };
}

registerPersistence('mongo', createMongoPersistence);
