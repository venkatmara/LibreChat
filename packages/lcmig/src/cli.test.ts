import { parseStage, run } from './cli';

describe('lcmig cli', () => {
  it('accepts a known stage', () => {
    expect(parseStage('profile')).toBe('profile');
    expect(run(['load'])).toContain('"load"');
  });

  it('rejects an unknown stage with usage', () => {
    expect(() => parseStage('bogus')).toThrow(/Usage: lcmig/);
  });
});
