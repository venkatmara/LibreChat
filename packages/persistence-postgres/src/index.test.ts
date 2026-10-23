import { createPersistence } from '@lcmig/persistence-core';
import './index';

describe('postgres adapter skeleton', () => {
  it('registers itself and reports healthy', async () => {
    const p = await createPersistence('postgres');
    expect(await p.health()).toEqual({ adapter: 'postgres', ok: true });
  });
});
