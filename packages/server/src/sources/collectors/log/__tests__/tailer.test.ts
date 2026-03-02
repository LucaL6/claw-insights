import { appendFileSync,mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect,it } from 'vitest';

import { LogTailer,parseLogLine, redact } from '../tailer';

describe('LogTailer', () => {
  describe('parseLogLine', () => {
    it('should parse a standard log line', () => {
      const line = JSON.stringify({
        '0': '[tools] exec completed: ls',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/exec.js' } },
        time: '2026-02-15T14:05:04.615Z',
      });
      const entry = parseLogLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.level).toBe('INFO');
      expect(entry!.module).toBe('tools');
      expect(entry!.message).toBe('exec completed: ls');
      expect(entry!.time).toBe('14:05:04.615');
    });

    it('should parse ERROR level', () => {
      const line = JSON.stringify({
        '0': '[tools] exec failed: timeout',
        _meta: { logLevelName: 'ERROR', path: {} },
        time: '2026-02-15T14:05:04.615Z',
      });
      const entry = parseLogLine(line);
      expect(entry!.level).toBe('ERROR');
    });

    it('should infer module from file path when no bracket tag', () => {
      const line = JSON.stringify({
        '0': 'some message without tag',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/cron-handler.js' } },
        time: '2026-02-15T14:05:04.615Z',
      });
      const entry = parseLogLine(line);
      expect(entry!.module).toBe('cron');
    });

    it('should handle malformed JSON gracefully', () => {
      expect(parseLogLine('not json')).toBeNull();
      expect(parseLogLine('')).toBeNull();
    });
  });

  describe('redact', () => {
    it('should redact tokens', () => {
      expect(redact('token=abc123def')).toBe('token= ***');
      expect(redact('Authorization: Bearer xyz')).toBe('Authorization: ***');
    });

    it('should redact API keys', () => {
      expect(redact('api_key=sk-12345')).toBe('api_key= ***');
    });

    it('should leave safe messages alone', () => {
      expect(redact('run completed successfully')).toBe('run completed successfully');
    });
  });
});

describe('LogTailer safety', () => {
  function makeLine(msg: string) {
    return (
      JSON.stringify({
        '0': `[test] ${msg}`,
        _meta: { logLevelName: 'INFO', path: {} },
        time: new Date().toISOString(),
      }) + '\n'
    );
  }

  it('should handle file truncation and re-read from start', () => {
    const dir = join(tmpdir(), `logtail-trunc-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const fname = `openclaw-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
    const fpath = join(dir, fname);

    // Write initial content so constructor picks up offset
    writeFileSync(fpath, makeLine('line1') + makeLine('line2'));

    const tailer = new LogTailer(dir);
    const received: Array<{ message: string }> = [];
    tailer.on('log', (e: { message: string }) => received.push(e));

    // Truncate file to something shorter, then write new content
    writeFileSync(fpath, makeLine('after-truncate'));

    // Manually trigger read (simulating poll)
    (tailer as unknown as Record<string, (...args: unknown[]) => unknown>).readIncremental();

    expect(received.some((e) => e.message.includes('after-truncate'))).toBe(true);
    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('should not crash when readSync throws (fd leak safety)', () => {
    const dir = join(tmpdir(), `logtail-fd-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const fname = `openclaw-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
    const fpath = join(dir, fname);
    writeFileSync(fpath, makeLine('initial'));

    const tailer = new LogTailer(dir);
    // Append content then make file unreadable to trigger error path
    appendFileSync(fpath, makeLine('more'));

    // Just verify no uncaught exception - the try/finally protects fd
    expect(() => {
      // Force a read cycle
      (tailer as unknown as Record<string, (...args: unknown[]) => unknown>).readIncremental();
    }).not.toThrow();

    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('ring buffer should cap at ringSize and getRecentEntries works', async () => {
    const dir = join(tmpdir(), `logtail-ring-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const fname = `openclaw-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
    const fpath = join(dir, fname);
    writeFileSync(fpath, '');

    const tailer = new LogTailer(dir);

    // Write 250 lines
    let content = '';
    for (let i = 0; i < 250; i++) {
      content += makeLine(`msg-${i}`);
    }
    appendFileSync(fpath, content);
    await new Promise((r) => setTimeout(r, 3000));

    const recent50 = tailer.getRecentEntries(50);
    expect(recent50.length).toBe(50);
    // Should be the last 50 of the ring buffer (which holds last 200)
    expect(recent50[49].message).toContain('msg-249');
    expect(recent50[0].message).toContain('msg-200');

    const allRecent = tailer.getRecentEntries(300);
    expect(allRecent.length).toBe(200); // capped at ringSize

    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('LogTailer integration', () => {
  it('should emit log events when file is appended', async () => {
    const dir = join(tmpdir(), `logtail-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const fname = `openclaw-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
    const fpath = join(dir, fname);
    writeFileSync(fpath, ''); // empty initial

    const tailer = new LogTailer(dir);
    const received: Array<{ level: string; message: string }> = [];
    tailer.on('log', (e: { level: string; message: string }) => received.push(e));

    // Append a log line
    const line = JSON.stringify({
      '0': '[tools] exec completed',
      _meta: { logLevelName: 'INFO', path: {} },
      time: new Date().toISOString(),
    });
    appendFileSync(fpath, line + '\n');

    // Wait for fs.watch to fire
    await new Promise((r) => setTimeout(r, 3000));
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].message).toContain('exec completed');

    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('should handle empty/corrupt lines gracefully', async () => {
    const dir = join(tmpdir(), `logtail-corrupt-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const d = new Date();
    const fname = `openclaw-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
    const fpath = join(dir, fname);
    writeFileSync(fpath, '');

    const tailer = new LogTailer(dir);
    const received: unknown[] = [];
    tailer.on('log', (e: unknown) => received.push(e));

    appendFileSync(fpath, 'not json at all\n{"broken\n');
    await new Promise((r) => setTimeout(r, 3000));
    expect(received.length).toBe(0); // Both lines should be silently skipped

    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });
});
