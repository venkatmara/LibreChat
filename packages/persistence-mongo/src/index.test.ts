import { createPersistence } from '@lcmig/persistence-core';
import './index';

describe('mongo adapter skeleton', () => {
  it('registers itself and reports healthy', async () => {
    const p = await createPersistence('mongo');
    expect(await p.health()).toEqual({ adapter: 'mongo', ok: true });
  });
});
