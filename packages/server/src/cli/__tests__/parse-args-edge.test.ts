import { describe, expect, it } from 'vitest';

import { parseCliArgs } from '../parse-args.js';

describe('parseCliArgs edge branches', () => {
  it('parses all valid subcommands', () => {
    for (const cmd of ['start', 'stop', 'status', 'logs', 'restart', 'snapshot']) {
      expect(parseCliArgs([cmd]).command).toBe(cmd);
    }
  });

  it('parses --server-only flag', () => {
    expect(parseCliArgs(['--server-only']).serverOnly).toBe(true);
  });

  it('parses --no-auth flag', () => {
    expect(parseCliArgs(['--no-auth']).noAuth).toBe(true);
  });

  it('parses --gateway option', () => {
    expect(parseCliArgs(['--gateway', 'ws://localhost:8080']).gateway).toBe('ws://localhost:8080');
  });

  it('parses --log-dir option', () => {
    expect(parseCliArgs(['--log-dir', '/var/log']).logDir).toBe('/var/log');
  });

  it('parses --open flag', () => {
    expect(parseCliArgs(['--open']).open).toBe(true);
  });

  it('parses --help and --version', () => {
    expect(parseCliArgs(['--help']).help).toBe(true);
    expect(parseCliArgs(['--version']).version).toBe(true);
  });

  it('parses -p short flag for port', () => {
    expect(parseCliArgs(['-p', '9999']).port).toBe(9999);
    expect(parseCliArgs(['-p', '9999']).portExplicit).toBe(true);
  });

  it('parses --web-port', () => {
    expect(parseCliArgs(['--web-port', '8888']).webPort).toBe(8888);
    expect(parseCliArgs(['--web-port', '8888']).webPortExplicit).toBe(true);
  });

  it('first arg starting with - is not treated as subcommand', () => {
    expect(parseCliArgs(['-p', '3000']).command).toBe('run');
  });
});
