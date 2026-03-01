import { writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runSnapshotCmd } from '../snapshot-cmd.js';

// Make process.exit throw so code after it doesn't continue
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    writeFileSync: vi.fn(original.writeFileSync),
  };
});

describe('runSnapshotCmd', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(writeFileSync).mockClear();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new ExitError(code as number);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── dry-run branch ──

  it('--dry-run prints parameters and returns', async () => {
    await runSnapshotCmd(['--dry-run']);

    const output = logSpy.mock.calls.map((c: string[]) => c.join(' ')).join('\n');
    expect(output).toContain('Snapshot parameters:');
    expect(output).toContain('format: png');
    expect(output).toContain('detail: standard');
    expect(output).toContain('range: 6h');
    expect(output).toContain('theme: dark');
    expect(output).toContain('lang: en');
    expect(output).toContain('layout: desktop');
  });

  it('--dry-run with --quick shows compact + mobile', async () => {
    await runSnapshotCmd(['--dry-run', '--quick']);

    const output = logSpy.mock.calls.map((c: string[]) => c.join(' ')).join('\n');
    expect(output).toContain('detail: compact');
    expect(output).toContain('layout: mobile');
  });

  // ── fetch error (server not running) ──

  it('exits 1 when server is not running (fetch fails)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(runSnapshotCmd([])).rejects.toThrow(ExitError);

    const errOutput = errorSpy.mock.calls.map((c: string[]) => c.join(' ')).join('\n');
    expect(errOutput).toContain('not running');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── HTTP error responses ──

  it('exits 1 on non-ok HTTP response with error + suggestion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'snapshot failed', suggestion: 'check logs' }),
    } as Response);

    await expect(runSnapshotCmd([])).rejects.toThrow(ExitError);

    const errOutput = errorSpy.mock.calls.map((c: string[]) => c.join(' ')).join('\n');
    expect(errOutput).toContain('snapshot failed');
    expect(errOutput).toContain('check logs');
  });

  it('exits 1 on non-ok response when json body parse fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(runSnapshotCmd([])).rejects.toThrow(ExitError);

    const errOutput = errorSpy.mock.calls.map((c: string[]) => c.join(' ')).join('\n');
    expect(errOutput).toContain('Bad Gateway');
  });

  // ── Successful responses ──

  function mockSuccessfulFetch(data: string): ReturnType<typeof vi.spyOn> {
    const buf = Buffer.from(data);
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    } as Response);
  }

  it('saves to file with --output', async () => {
    mockSuccessfulFetch('PNG_DATA');

    await runSnapshotCmd(['-o', '/tmp/test-snap.png']);

    expect(vi.mocked(writeFileSync)).toHaveBeenCalledWith('/tmp/test-snap.png', expect.any(Buffer));
    expect(logSpy.mock.calls.flat().join(' ')).toContain('Saved: /tmp/test-snap.png');
  });

  it('writes json to stdout when format is json', async () => {
    mockSuccessfulFetch('{"status":"ok"}');

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const isTTYOrig = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    await runSnapshotCmd(['--format', 'json']);

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const written = stdoutWriteSpy.mock.calls[0]?.[0];
    expect(written?.toString()).toContain('status');

    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  it('auto-generates filename on TTY without --output', async () => {
    mockSuccessfulFetch('PNG_DATA');

    const isTTYOrig = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    await runSnapshotCmd([]);

    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    const filename = vi.mocked(writeFileSync).mock.calls[0][0] as string;
    expect(filename).toMatch(/claw-insights-snapshot-.*\.png$/);
    expect(logSpy.mock.calls.flat().join(' ')).toContain('Saved: ./');

    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  it('auto-generates .svg extension for svg format', async () => {
    mockSuccessfulFetch('<svg></svg>');

    const isTTYOrig = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    await runSnapshotCmd(['--format', 'svg']);

    const filename = vi.mocked(writeFileSync).mock.calls[0][0] as string;
    expect(filename).toMatch(/\.svg$/);

    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  it('pipes binary to stdout on non-TTY without --output', async () => {
    mockSuccessfulFetch('BINARY_PNG');

    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const isTTYOrig = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    await runSnapshotCmd([]);

    expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.any(Buffer));

    Object.defineProperty(process.stdout, 'isTTY', { value: isTTYOrig, configurable: true });
  });

  // ── Auth token resolution ──

  it('sends Authorization header from --token flag', async () => {
    const fetchSpy = mockSuccessfulFetch('{}');

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    await runSnapshotCmd(['-t', 'my-token', '--format', 'json']);

    const [, opts] = fetchSpy.mock.calls[0];
    const headers = opts?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('sends no Authorization header when no token available', async () => {
    const fetchSpy = mockSuccessfulFetch('{}');

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    // Clear env token + override HOME to avoid reading real token file
    const origEnv = process.env.CLAW_INSIGHTS_API_TOKEN;
    const origHome = process.env.HOME;
    delete process.env.CLAW_INSIGHTS_API_TOKEN;
    process.env.HOME = '/nonexistent-test-home';

    await runSnapshotCmd(['--format', 'json']);

    const [, opts] = fetchSpy.mock.calls[0];
    const headers = opts?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();

    process.env.CLAW_INSIGHTS_API_TOKEN = origEnv;
    process.env.HOME = origHome;
  });
});
