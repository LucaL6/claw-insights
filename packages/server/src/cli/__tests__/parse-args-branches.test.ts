import { describe, expect,it } from 'vitest';

import { parseCliArgs } from '../parse-args.js';

describe('parseCliArgs branches', () => {
  it('treats unknown subcommand as run (not a valid subcommand)', () => {
    const result = parseCliArgs(['unknown-cmd']);
    expect(result.command).toBe('run');
  });

  it('defaults port to 4000 when not provided', () => {
    const result = parseCliArgs([]);
    expect(result.port).toBe(4000);
  });

  it('defaults webPort to 3200 when not provided', () => {
    const result = parseCliArgs([]);
    expect(result.webPort).toBe(3200);
  });

  it('defaults lines to undefined when not provided', () => {
    const result = parseCliArgs([]);
    expect(result.lines).toBeUndefined();
  });

  it('parses lines when provided', () => {
    const result = parseCliArgs(['-n', '100']);
    expect(result.lines).toBe(100);
  });
});
