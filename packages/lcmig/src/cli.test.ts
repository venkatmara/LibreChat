import { run } from './index';

describe('lcmig cli', () => {
  it('accepts a known stage', () => {
    expect(run(['load'])).toContain('load');
  });

  it('rejects an unknown stage', () => {
    expect(() => run(['bogus'])).toThrow(/Unknown command/);
  });
});
