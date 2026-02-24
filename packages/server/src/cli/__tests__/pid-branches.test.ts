import { mkdtempSync, rmSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect,it } from 'vitest';

import { PidFile } from '../pid.js';

describe('PidFile branches', () => {
  it('writes to existing directory (no mkdir needed)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pf = new PidFile(join(dir, 'test.pid'));
      pf.write(process.pid);
      expect(pf.read()).toBe(process.pid);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates nested directory when missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pf = new PidFile(join(dir, 'nested', 'deep', 'test.pid'));
      pf.write(process.pid);
      expect(pf.read()).toBe(process.pid);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null for invalid PID content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pidPath = join(dir, 'bad.pid');
      writeFileSync(pidPath, 'not-a-number');
      const pf = new PidFile(pidPath);
      expect(pf.read()).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('remove is no-op when file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pf = new PidFile(join(dir, 'nope.pid'));
      expect(() => pf.remove()).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('isAlive returns false when no PID file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pf = new PidFile(join(dir, 'nope.pid'));
      expect(pf.isAlive()).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cleanStale is no-op when no PID file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pid-br-'));
    try {
      const pf = new PidFile(join(dir, 'nope.pid'));
      expect(() => pf.cleanStale()).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
