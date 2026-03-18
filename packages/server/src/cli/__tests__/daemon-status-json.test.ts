import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for `daemonStatus({ json: true })` end-to-end contract.
 *
 * We mock PidFile + fetch to isolate daemon.ts logic, then capture stdout
 * to verify the JSON contract shape and human-mode invariance.
 */

// Capture stdout writes
function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const origWrite = process.stdout.write;
  const origLog = console.log;

  // Intercept both console.log and process.stdout.write
  console.log = (...args: unknown[]) => {
    chunks.push(args.map(String).join(' ') + '\n');
  };
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;

  return fn()
    .finally(() => {
      process.stdout.write = origWrite;
      console.log = origLog;
    })
    .then(() => chunks.join(''));
}

// Required top-level keys per contract v1
const REQUIRED_KEYS = ['schemaVersion', 'version', 'server', 'web', 'auth', 'health'];

describe('daemonStatus --json', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `ci-daemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('stopped state (no PID file)', () => {
    it('outputs valid JSON to stdout with all required keys', async () => {
      // Mock getDataDir to return our temp dir
      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      // Clear module cache to pick up mocks
      const daemon = await import('../daemon.js');

      const output = await captureStdout(() => daemon.daemonStatus({ json: true }));

      // Must be valid JSON
      const parsed = JSON.parse(output.trim());

      // All required keys present
      for (const key of REQUIRED_KEYS) {
        expect(parsed).toHaveProperty(key);
      }

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.server.state).toBe('stopped');
      expect(parsed.server.pid).toBeNull();
      expect(parsed.auth.accessUrl).toBeNull();
      expect(parsed.health.ok).toBe(false);
    });

    it('stdout contains ONLY JSON (no emoji, no human text)', async () => {
      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      const daemon = await import('../daemon.js');
      const output = await captureStdout(() => daemon.daemonStatus({ json: true }));

      // Entire stdout must be parseable as single JSON object
      const trimmed = output.trim();
      expect(() => JSON.parse(trimmed)).not.toThrow();

      // No emoji/human text leaked
      expect(trimmed).not.toContain('💡');
      expect(trimmed).not.toContain('Claw Insights is not running');
    });
  });

  describe('running state', () => {
    it('outputs running contract when health check succeeds', async () => {
      // Create PID file pointing to our own PID (always alive)
      const pidPath = join(tempDir, 'claw-insights.pid');
      writeFileSync(pidPath, String(process.pid));

      // Write daemon.json with port config
      writeFileSync(join(tempDir, 'daemon.json'), JSON.stringify({ port: 41041 }));
      writeFileSync(join(tempDir, 'auth-token'), 'abc123');

      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      // Mock global fetch for health endpoint
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'ok',
            mode: 'dashboard',
            uptime: 120,
            gateway: 'connected',
            db: 'ok',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const daemon = await import('../daemon.js');
      const output = await captureStdout(() => daemon.daemonStatus({ json: true }));
      const parsed = JSON.parse(output.trim());

      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.server.state).toBe('running');
      expect(parsed.server.pid).toBe(process.pid);
      expect(parsed.auth.accessUrl).toBe('http://127.0.0.1:41041/?token=abc123');
      expect(parsed.health.ok).toBe(true);

      vi.unstubAllGlobals();
    });

    it('outputs degraded when health check fails', async () => {
      const pidPath = join(tempDir, 'claw-insights.pid');
      writeFileSync(pidPath, String(process.pid));
      writeFileSync(join(tempDir, 'daemon.json'), JSON.stringify({ port: 41041 }));

      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

      const daemon = await import('../daemon.js');
      const output = await captureStdout(() => daemon.daemonStatus({ json: true }));
      const parsed = JSON.parse(output.trim());

      expect(parsed.server.state).toBe('degraded');
      expect(parsed.health.ok).toBe(false);

      vi.unstubAllGlobals();
    });

    it('outputs degraded when health endpoint returns non-2xx', async () => {
      const pidPath = join(tempDir, 'claw-insights.pid');
      writeFileSync(pidPath, String(process.pid));
      writeFileSync(join(tempDir, 'daemon.json'), JSON.stringify({ port: 41041 }));

      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ status: 'ok', gateway: 'connected', db: 'ok' }),
        }),
      );

      const daemon = await import('../daemon.js');
      const output = await captureStdout(() => daemon.daemonStatus({ json: true }));
      const parsed = JSON.parse(output.trim());

      expect(parsed.server.state).toBe('degraded');
      expect(parsed.health.ok).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('human mode invariance', () => {
    it('does NOT output JSON when json option is false/omitted', async () => {
      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      const daemon = await import('../daemon.js');
      const output = await captureStdout(() => daemon.daemonStatus());

      // Should be human-readable, not JSON
      expect(output).toContain('💡');
      expect(() => JSON.parse(output.trim())).toThrow();
    });
  });

  describe('exit semantics', () => {
    it('does not throw on stopped state in json mode', async () => {
      vi.doMock('../../paths.js', () => ({
        getDataDir: () => tempDir,
      }));

      const daemon = await import('../daemon.js');
      // Should resolve without throwing
      await expect(daemon.daemonStatus({ json: true })).resolves.toBeUndefined();
    });
  });
});
