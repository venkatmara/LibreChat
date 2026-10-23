import { Persistence, registerPersistence } from '@lcmig/persistence-core';

export function createPostgresPersistence(): Persistence {
  return {
    name: 'postgres',
    health: async () => ({ adapter: 'postgres', ok: true }),
    close: async () => undefined,
  };
}

registerPersistence('postgres', createPostgresPersistence);
