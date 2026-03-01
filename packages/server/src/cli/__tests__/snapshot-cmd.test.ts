import { describe, expect, it, vi } from 'vitest';

import { parseSnapshotArgs, runSnapshotCmd } from '../snapshot-cmd.js';

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
