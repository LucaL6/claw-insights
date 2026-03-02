import { describe, expect, it } from 'vitest';

import { parseLogLine, redact } from '../tailer';

describe('parseLogLine branches', () => {
  it('returns null for invalid JSON', () => {
    expect(parseLogLine('not json')).toBeNull();
  });

  it('handles missing 0 field', () => {
    const entry = parseLogLine(JSON.stringify({ _meta: { logLevelName: 'INFO' } }));
    expect(entry).not.toBeNull();
    expect(entry!.message).toBe('');
  });

  it('handles missing time field', () => {
    const entry = parseLogLine(JSON.stringify({ '0': 'msg' }));
    expect(entry).not.toBeNull();
    expect(entry!.time).toBe('');
  });

  it('defaults unknown log level to INFO', () => {
    const entry = parseLogLine(JSON.stringify({ '0': 'msg', _meta: { logLevelName: 'TRACE' } }));
    expect(entry!.level).toBe('INFO');
  });

  it('handles missing logLevelName', () => {
    const entry = parseLogLine(JSON.stringify({ '0': 'msg', _meta: {} }));
    expect(entry!.level).toBe('INFO');
  });

  it('infers module from cron path', () => {
    const entry = parseLogLine(
      JSON.stringify({
        '0': 'running job',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/cron/scheduler.js' } },
      }),
    );
    expect(entry!.module).toBe('cron');
  });

  it('infers module from agent path', () => {
    const entry = parseLogLine(
      JSON.stringify({
        '0': 'agent msg',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/agent/runner.js' } },
      }),
    );
    expect(entry!.module).toBe('agent/embedded');
  });

  it('defaults module to system when no match', () => {
    const entry = parseLogLine(
      JSON.stringify({
        '0': 'generic msg',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/other.js' } },
      }),
    );
    expect(entry!.module).toBe('system');
  });

  it('handles missing _meta entirely', () => {
    const entry = parseLogLine(JSON.stringify({ '0': 'msg' }));
    expect(entry!.module).toBe('system');
  });

  it('handles time without T separator', () => {
    const entry = parseLogLine(JSON.stringify({ '0': 'msg', time: 'noT' }));
    expect(entry!.time).toBe('');
  });
});

describe('parseLogLine with missing path', () => {
  it('infers exec module from filePath', () => {
    const entry = parseLogLine(
      JSON.stringify({
        '0': 'exec completed',
        _meta: { logLevelName: 'INFO', path: { filePath: '/dist/exec/runner.js' } },
      }),
    );
    expect(entry!.module).toBe('tools');
  });
});

describe('redact branches', () => {
  it('redacts key= format', () => {
    const result = redact('token= abc123');
    expect(result).toBe('token= ***');
  });

  it('redacts key: format', () => {
    const result = redact('Authorization: Bearer xyz');
    expect(result).toBe('Authorization: ***');
  });

  it('does not redact normal text', () => {
    const result = redact('normal log message');
    expect(result).toBe('normal log message');
  });
});
