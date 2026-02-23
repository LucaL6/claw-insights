import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../parse-args.js';

describe('parseCliArgs', () => {
  it('defaults to foreground run with no args', () => {
    const result = parseCliArgs([]);
    expect(result.command).toBe('run');
    expect(result.port).toBe(4000);
    expect(result.webPort).toBe(3200);
    expect(result.serverOnly).toBe(false);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses start subcommand', () => {
    const result = parseCliArgs(['start']);
    expect(result.command).toBe('start');
  });

  it('parses stop subcommand', () => {
    const result = parseCliArgs(['stop']);
    expect(result.command).toBe('stop');
  });

  it('parses status subcommand', () => {
    const result = parseCliArgs(['status']);
    expect(result.command).toBe('status');
  });

  it('parses logs subcommand', () => {
    const result = parseCliArgs(['logs']);
    expect(result.command).toBe('logs');
  });

  it('parses logs --lines', () => {
    const result = parseCliArgs(['logs', '--lines', '50']);
    expect(result.command).toBe('logs');
    expect(result.lines).toBe(50);
  });

  it('parses restart subcommand', () => {
    const result = parseCliArgs(['restart']);
    expect(result.command).toBe('restart');
  });

  it('parses --server-only flag', () => {
    const result = parseCliArgs(['--server-only']);
    expect(result.serverOnly).toBe(true);
  });

  it('parses --port', () => {
    const result = parseCliArgs(['--port', '5000']);
    expect(result.port).toBe(5000);
  });

  it('parses --web-port', () => {
    const result = parseCliArgs(['--web-port', '8080']);
    expect(result.webPort).toBe(8080);
  });

  it('parses start --server-only --port', () => {
    const result = parseCliArgs(['start', '--server-only', '--port', '9000']);
    expect(result.command).toBe('start');
    expect(result.serverOnly).toBe(true);
    expect(result.port).toBe(9000);
  });

  it('parses --help', () => {
    const result = parseCliArgs(['--help']);
    expect(result.help).toBe(true);
  });

  it('parses --version', () => {
    const result = parseCliArgs(['--version']);
    expect(result.version).toBe(true);
  });

  it('parses --gateway', () => {
    const result = parseCliArgs(['--gateway', 'http://example.com:3377']);
    expect(result.gateway).toBe('http://example.com:3377');
  });

  it('parses --log-dir', () => {
    const result = parseCliArgs(['--log-dir', '/tmp/logs']);
    expect(result.logDir).toBe('/tmp/logs');
  });

  it('parses --no-auth flag', () => {
    const args = parseCliArgs(['start', '--no-auth']);
    expect(args.noAuth).toBe(true);
  });

  it('defaults noAuth to false', () => {
    const args = parseCliArgs(['start']);
    expect(args.noAuth).toBe(false);
  });
});
