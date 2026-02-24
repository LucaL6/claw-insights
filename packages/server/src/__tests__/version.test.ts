import { describe, expect,it } from 'vitest';

import { getAppVersion } from '../version.js';

describe('getAppVersion', () => {
  it('returns a valid semver string', () => {
    const v = getAppVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
    expect(v).not.toBe('0.0.0');
  });

  it('returns same value on repeated calls (cached)', () => {
    expect(getAppVersion()).toBe(getAppVersion());
  });
});
