import type { PersistenceModule } from '@lcmig/persistence-core';
import type { Connection, Model } from 'mongoose';
import { MongoUserRepo } from './user-repo';
import type { MongoUserDoc } from './user-mapper';

export interface MongoModuleDeps {
  connection: Connection;
  /** The existing data-schemas user model (`createModels(mongoose).User`). */
  userModel: Model<MongoUserDoc>;
}

/** Mongo adapter: re-homes the existing Mongoose user model behind the ports. */
export function createMongoModule(deps: MongoModuleDeps): PersistenceModule {
  return {
    name: 'mongo',
    users: new MongoUserRepo(deps.userModel),
    health: async () => ({ ok: deps.connection.readyState === 1, adapter: 'mongo' }),
    close: async () => {
      await deps.connection.close();
    },
  };
}

export { MongoUserRepo } from './user-repo';
export { mapMongoError } from './errors';
export { toUserRecord } from './user-mapper';
export type { MongoUserDoc } from './user-mapper';
