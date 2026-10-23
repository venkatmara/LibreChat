import type { PersistenceModule } from '@lcmig/persistence-core';

/** Skeleton postgres adapter; repository ports are implemented slice by slice. */
export function createPostgresModule(): PersistenceModule {
  return { name: 'postgres', health: async () => ({ ok: true, adapter: 'postgres' }) };
}
