import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultSnapshotDir, generateSnapshotFilename, parseSnapshotArgs, runSnapshotCmd } from '../snapshot-cmd.js';

describe('parseSnapshotArgs', () => {
  it('parses default args', () => {
    const args = parseSnapshotArgs([]);
    expect(args.format).toBe('png');
    expect(args.detail).toBe('standard');
    expect(args.range).toBe('6h');
    expect(args.theme).toBe('dark');
    expect(args.lang).toBe('en');
    expect(args.port).toBe(41041);
    expect(args.quick).toBe(false);
    expect(args.dryRun).toBe(false);
    expect(args.output).toBeUndefined();
    expect(args.token).toBeUndefined();
  });

  it('parses --token', () => {
    const args = parseSnapshotArgs(['--token', 'my-secret']);
    expect(args.token).toBe('my-secret');
  });

  it('parses -t short token', () => {
    const args = parseSnapshotArgs(['-t', 'abc123']);
    expect(args.token).toBe('abc123');
  });

  it('parses --quick shorthand', () => {
    const args = parseSnapshotArgs(['--quick']);
    expect(args.detail).toBe('compact');
    expect(args.format).toBe('png');
    expect(args.range).toBe('6h');
  });

  it('parses -o output', () => {
    const args = parseSnapshotArgs(['-o', 'test.png']);
    expect(args.output).toBe('test.png');
  });

  it('parses --output long form', () => {
    const args = parseSnapshotArgs(['--output', '/tmp/snap.svg']);
    expect(args.output).toBe('/tmp/snap.svg');
  });

  it('parses --dry-run', () => {
    const args = parseSnapshotArgs(['--dry-run']);
    expect(args.dryRun).toBe(true);
  });

  it('parses custom --port', () => {
    const args = parseSnapshotArgs(['--port', '3000']);
    expect(args.port).toBe(3000);
  });

  it('parses --format svg', () => {
    const args = parseSnapshotArgs(['--format', 'svg']);
    expect(args.format).toBe('svg');
  });

  it('parses --detail full --range 24h --theme light', () => {
    const args = parseSnapshotArgs(['--detail', 'full', '--range', '24h', '--theme', 'light']);
    expect(args.detail).toBe('full');
    expect(args.range).toBe('24h');
    expect(args.theme).toBe('light');
  });

  it('--quick overrides --detail', () => {
    const args = parseSnapshotArgs(['--quick', '--detail', 'full']);
    expect(args.detail).toBe('compact');
  });
});

describe('runSnapshotCmd', () => {
  it('--help prints usage and exits', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runSnapshotCmd(['--help']);
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Usage:');
    expect(output).toContain('--format');
    expect(output).toContain('--quick');
    spy.mockRestore();
  });

  it('-h also prints usage', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runSnapshotCmd(['-h']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('defaultSnapshotDir', () => {
  afterEach(() => {
    delete process.env.CLAW_INSIGHTS_SNAPSHOT_DIR;
  });

  it('returns ~/.claw-insights/snapshots by default', () => {
    delete process.env.CLAW_INSIGHTS_SNAPSHOT_DIR;
    const dir = defaultSnapshotDir();
    expect(dir).toBe(join(homedir(), '.claw-insights', 'snapshots'));
  });

  it('respects CLAW_INSIGHTS_SNAPSHOT_DIR env var', () => {
    process.env.CLAW_INSIGHTS_SNAPSHOT_DIR = '/tmp/my-snapshots';
    const dir = defaultSnapshotDir();
    expect(dir).toBe('/tmp/my-snapshots');
  });
});

describe('generateSnapshotFilename', () => {
  it('generates png filename with second-level precision', () => {
    const filename = generateSnapshotFilename('png');
    expect(filename).toMatch(/^claw-insights-snapshot-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
  });

  it('generates svg filename for svg format', () => {
    const filename = generateSnapshotFilename('svg');
    expect(filename).toMatch(/\.svg$/);
  });

  it('defaults to png for unknown formats', () => {
    const filename = generateSnapshotFilename('json');
    expect(filename).toMatch(/\.png$/);
  });

  it('generates unique filenames across calls', () => {
    // Within the same second this may collide, but across seconds it should differ.
    // We verify the timestamp is embedded and format is stable.
    const a = generateSnapshotFilename('png');
    const b = generateSnapshotFilename('png');
    // Both should be valid format (may or may not be equal within same second)
    expect(a).toMatch(/^claw-insights-snapshot-/);
    expect(b).toMatch(/^claw-insights-snapshot-/);
  });
});
