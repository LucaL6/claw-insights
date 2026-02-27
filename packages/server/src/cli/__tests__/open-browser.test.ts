import { describe, expect, it } from 'vitest';

import { getOpenCommand } from '../open-browser.js';

describe('getOpenCommand', () => {
  it('returns "open" for darwin', () => {
    expect(getOpenCommand('darwin')).toBe('open');
  });

  it('returns "xdg-open" for linux', () => {
    expect(getOpenCommand('linux')).toBe('xdg-open');
  });

  it('returns "start" for win32', () => {
    expect(getOpenCommand('win32')).toBe('start');
  });

  it('returns null for unknown platform', () => {
    expect(getOpenCommand('freebsd')).toBeNull();
  });
});
