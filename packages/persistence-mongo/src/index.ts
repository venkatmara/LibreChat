import type { PersistenceModule } from '@lcmig/persistence-core';

/** Skeleton mongo adapter; repository ports are implemented slice by slice. */
export function createMongoModule(): PersistenceModule {
  return { name: 'mongo', health: async () => ({ ok: true, adapter: 'mongo' }) };
}
