import { describe, it, expect } from 'vitest';
import { getAppVersion } from '../../../version.js';

describe('getAppVersion', () => {
  it('should return a real version, not 0.0.0', () => {
    const version = getAppVersion();
    expect(version).not.toBe('0.0.0');
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
