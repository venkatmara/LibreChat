import type { Connection, Model } from 'mongoose';
import { createMongoModule } from './index';
import type { MongoUserDoc } from './user-mapper';

describe('mongo module', () => {
  const stub = (readyState: number) => {
    const close = jest.fn(async () => undefined);
    const connection = { readyState, close } as unknown as Connection;
    const userModel = {} as unknown as Model<MongoUserDoc>;
    return { module: createMongoModule({ connection, userModel }), close };
  };

  it('reports healthy when connected', async () => {
    expect(await stub(1).module.health()).toEqual({ ok: true, adapter: 'mongo' });
  });

  it('reports unhealthy when disconnected and closes the connection', async () => {
    const { module, close } = stub(0);
    expect(await module.health()).toEqual({ ok: false, adapter: 'mongo' });
    await module.close();
    expect(close).toHaveBeenCalled();
  });
});
