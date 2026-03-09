import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { formatLogFilename, LogWriter } from '../writer.js';

describe('formatLogFilename', () => {
  it('produces correct format', () => {
    expect(formatLogFilename('app', '2026-03-08', 1)).toBe('app.2026-03-08.0001.log');
    expect(formatLogFilename('error', '2026-01-01', 42)).toBe('error.2026-01-01.0042.log');
  });
});

describe('LogWriter', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = join(tmpdir(), `log-writer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
  });

  it('creates log files on first append', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('app', 'bestEffort', '{"msg":"hello"}');
    await writer.shutdown();
    const files = readdirSync(logDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^app\.\d{4}-\d{2}-\d{2}\.0001\.log$/);
  });

  it('uses stream-level sync policy: error/security sync, app/debug/noise async', async () => {
    const writer = new LogWriter({ logDir });

    writer.append('error', 'critical', '{"msg":"critical"}');
    writer.append('security', 'critical', '{"msg":"security"}');
    writer.append('app', 'bestEffort', '{"msg":"app"}');
    writer.append('debug', 'bestEffort', '{"msg":"debug"}');
    writer.append('noise', 'bestEffort', '{"msg":"noise"}');

    expect(writer.streamSyncMode('error')).toBe(true);
    expect(writer.streamSyncMode('security')).toBe(true);
    expect(writer.streamSyncMode('app')).toBe(false);
    expect(writer.streamSyncMode('debug')).toBe(false);
    expect(writer.streamSyncMode('noise')).toBe(false);

    await writer.shutdown();
  });

  it('keeps app/debug async even if lane input is critical', async () => {
    const writer = new LogWriter({ logDir });

    writer.append('app', 'critical', '{"msg":"app-critical"}');
    writer.append('debug', 'critical', '{"msg":"debug-critical"}');

    expect(writer.streamSyncMode('app')).toBe(false);
    expect(writer.streamSyncMode('debug')).toBe(false);

    await writer.shutdown();
  });

  it('appends data correctly', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('error', 'critical', 'line1');
    writer.append('error', 'critical', 'line2');
    await writer.shutdown();
    const files = readdirSync(logDir).filter((f) => f.startsWith('error.'));
    const content = readFileSync(join(logDir, files[0]), 'utf-8');
    expect(content).toBe('line1\nline2\n');
  });

  it('rotates on size limit', async () => {
    // Set tiny size limit so second append triggers rotation.
    const writer = new LogWriter({ logDir, rotationSizeMb: { app: 64, debug: 0.00001, error: 32 } });
    writer.append('debug', 'bestEffort', 'first');
    writer.append('debug', 'bestEffort', 'second');
    await writer.shutdown();
    const files = readdirSync(logDir)
      .filter((f) => f.startsWith('debug.'))
      .sort();
    expect(files.length).toBe(2);
    // Second file should have incremented seq.
    expect(files[1]).toMatch(/\.0002\.log$/);
  });

  it('tracks bytes written', async () => {
    const writer = new LogWriter({ logDir });
    writer.append('app', 'bestEffort', 'hello');
    // 'hello\n' = 6 bytes
    expect(writer.bytesWritten('app')).toBe(6);
    await writer.shutdown();
  });

  it('drains pending critical queue then fsyncs before shutdown close', async () => {
    const writer = new LogWriter({ logDir, criticalSyncBatch: 1_000 });

    for (let i = 0; i < 50; i += 1) {
      writer.append('error', 'critical', `critical-${i}`);
    }

    await writer.shutdown();

    const files = readdirSync(logDir)
      .filter((f) => f.startsWith('error.'))
      .sort();
    const persisted = files.flatMap((file) => readFileSync(join(logDir, file), 'utf-8').split('\n').filter(Boolean));

    expect(persisted).toHaveLength(50);

    const metrics = writer as unknown as {
      shutdownOrder?: Array<'drain' | 'fsync' | 'close'>;
    };
    expect(metrics.shutdownOrder).toEqual(['drain', 'fsync', 'close']);
  });

  it('rotates with flush->create ordering telemetry', async () => {
    const writer = new LogWriter({
      logDir,
      rotationSizeMb: { app: 64, debug: 0.00001, error: 32 },
    });

    writer.append('debug', 'bestEffort', 'first');
    writer.append('debug', 'bestEffort', 'second');
    await writer.shutdown();

    const telemetry = writer as unknown as {
      rotationEvents?: Array<{ stream: string; steps: string[] }>;
    };

    expect(telemetry.rotationEvents?.[0]?.steps).toEqual(['flush', 'create']);
  });
});
