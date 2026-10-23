import { createPostgresModule } from './index';

describe('postgres module', () => {
  it('reports healthy', async () => {
    expect(await createPostgresModule().health()).toEqual({ ok: true, adapter: 'postgres' });
  });
});
