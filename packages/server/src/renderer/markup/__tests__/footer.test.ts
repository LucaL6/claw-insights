import { describe, it, expect, beforeEach } from 'vitest';

// Reset cached version between tests
beforeEach(async () => {
  // Re-import to get fresh module if needed
});

describe('getVersion', () => {
  it('should return a real version, not 0.0.0', async () => {
    const { getVersion } = await import('../footer.js');
    const version = getVersion();
    expect(version).not.toBe('0.0.0');
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
