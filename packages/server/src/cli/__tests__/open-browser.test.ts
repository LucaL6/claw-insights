import { execFile } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getOpenCommand, openBrowser } from '../open-browser.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

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

describe('openBrowser', () => {
  beforeEach(() => {
    vi.mocked(execFile).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls execFile with platform open command on darwin/linux', () => {
    // This runs on the actual platform (darwin in CI macOS)
    openBrowser('http://localhost:3000');

    const cmd = getOpenCommand(process.platform);
    if (cmd && cmd !== 'start') {
      expect(execFile).toHaveBeenCalledWith(cmd, ['http://localhost:3000'], expect.any(Function));
    }
  });

  it('does nothing on unsupported platform', () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true });

    openBrowser('http://localhost:3000');
    expect(execFile).not.toHaveBeenCalled();

    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });

  it('uses cmd /c start on windows', () => {
    const origPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    openBrowser('http://localhost:3000');
    expect(execFile).toHaveBeenCalledWith('cmd', ['/c', 'start', '""', 'http://localhost:3000'], expect.any(Function));

    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
  });
});
