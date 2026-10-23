import { createMongoModule } from './index';

describe('mongo module', () => {
  it('reports healthy', async () => {
    expect(await createMongoModule().health()).toEqual({ ok: true, adapter: 'mongo' });
  });
});
