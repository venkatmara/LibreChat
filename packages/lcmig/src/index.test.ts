import { run } from './index';

describe('lcmig run', () => {
  it('prints usage without arguments', () => {
    expect(run([])).toContain('Usage: lcmig');
  });

  it('rejects unknown commands', () => {
    expect(() => run(['nope'])).toThrow(/Unknown command/);
  });
});
