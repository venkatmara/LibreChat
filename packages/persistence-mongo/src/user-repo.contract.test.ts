import assert from 'node:assert/strict';
import { runUserRepoContract } from '@lcmig/persistence-core';
import { createMongoModule } from './index';
import { buildUserModel, connectTestMongo } from './test-support';

jest.setTimeout(120_000);

runUserRepoContract('mongo', async () => {
  const { connection, stop } = await connectTestMongo();
  const userModel = buildUserModel(connection);
  await userModel.init();
  const mod = createMongoModule({ connection, userModel });
  return {
    users: mod.users,
    reset: async () => {
      await userModel.deleteMany({});
    },
    teardown: async () => {
      await stop();
    },
  };
});

describe('mongo adapter port hygiene', () => {
  it('returns plain objects with string ids and no Mongo types', async () => {
    const { connection, stop } = await connectTestMongo();
    try {
      const userModel = buildUserModel(connection);
      await userModel.init();
      const { users } = createMongoModule({ connection, userModel });
      const created = await users.create({ email: 'p@example.com' });
      assert.equal(typeof created.id, 'string');
      assert.equal(Object.getPrototypeOf(created), Object.prototype);
      assert.ok(!('_id' in created) && !('__v' in created));
      assert.ok(!('passwordHash' in created));
    } finally {
      await stop();
    }
  });
});
