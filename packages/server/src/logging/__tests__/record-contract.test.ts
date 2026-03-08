import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LayeredRuntime } from '../runtime.js';
import { LoggingRuntimeState } from '../state.js';

const REQUIRED_FIELDS = ['ts', 'seq', 'level', 'module', 'msg', 'stream'] as const;

describe('record-contract', () => {
  let logDir: string;
  let runtime: LayeredRuntime;

  beforeEach(() => {
    logDir = join(tmpdir(), `record-contract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(logDir, { recursive: true });
    process.env.CLAW_INSIGHTS_LOG_DIR = logDir;
    const state = new LoggingRuntimeState();
    runtime = new LayeredRuntime({ runtimeState: state });
  });

  afterEach(async () => {
    await runtime.shutdown();
    rmSync(logDir, { recursive: true, force: true });
    delete process.env.CLAW_INSIGHTS_LOG_DIR;
  });

  function collectRecords(): Record<string, unknown>[] {
    const files = readdirSync(logDir).filter((f) => f.endsWith('.log'));
    const records: Record<string, unknown>[] = [];
    for (const file of files) {
      const content = readFileSync(join(logDir, file), 'utf-8');
      for (const line of content.split('\n').filter(Boolean)) {
        records.push(JSON.parse(line));
      }
    }
    return records.sort((a, b) => (a.seq as number) - (b.seq as number));
  }

  it('emits all required fields on every record', () => {
    runtime.write('info', 'test-mod', ['hello world']);
    runtime.write('error', 'test-mod', ['boom']);
    runtime.write('warn', 'other-mod', ['careful']);

    const records = collectRecords();
    expect(records.length).toBeGreaterThanOrEqual(1);

    for (const rec of records) {
      for (const field of REQUIRED_FIELDS) {
        expect(rec).toHaveProperty(field);
        expect(rec[field]).toBeDefined();
      }
    }
  });

  it('seq is monotonically increasing across all emitted records', async () => {
    for (let i = 0; i < 20; i++) {
      runtime.write('info', 'seq-test', [`message ${i}`]);
    }

    await runtime.shutdown();

    const records = collectRecords();
    expect(records.length).toBeGreaterThanOrEqual(1);

    for (let i = 1; i < records.length; i++) {
      expect(records[i]!.seq).toBeGreaterThan(records[i - 1]!.seq as number);
    }
  });

  it('stream field is a valid LogStream value', () => {
    runtime.write('info', 'stream-test', ['hi']);
    runtime.write('error', 'stream-test', ['bad']);
    runtime.write('debug', 'stream-test', ['verbose']);

    const records = collectRecords();
    const validStreams = new Set(['app', 'error', 'debug']);
    for (const rec of records) {
      expect(validStreams.has(rec.stream as string)).toBe(true);
    }
  });

  it('ts is a valid ISO 8601 timestamp', () => {
    runtime.write('info', 'ts-test', ['check timestamp']);

    const records = collectRecords();
    for (const rec of records) {
      const parsed = new Date(rec.ts as string);
      expect(parsed.getTime()).not.toBeNaN();
    }
  });
});
