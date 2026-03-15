import { describe, expect, it } from 'vitest';

import { assertSupportedNodeVersion, buildNodeArgsForServer, parseNodeMajor } from '../node-runtime.js';

describe('parseNodeMajor', () => {
  it('parses bare version string', () => {
    expect(parseNodeMajor('22.22.1')).toBe(22);
  });

  it('parses version with v prefix', () => {
    expect(parseNodeMajor('v23.5.0')).toBe(23);
  });

  it('throws on unparseable input', () => {
    expect(() => parseNodeMajor('abc')).toThrow(/Cannot parse/);
  });
});

describe('assertSupportedNodeVersion', () => {
  it('accepts Node 22.x', () => {
    expect(() => assertSupportedNodeVersion('22.22.1')).not.toThrow();
  });

  it('accepts Node 23+', () => {
    expect(() => assertSupportedNodeVersion('23.5.0')).not.toThrow();
  });

  it('rejects unsupported Node major versions', () => {
    expect(() => assertSupportedNodeVersion('21.7.0')).toThrow(/Node 22\+/);
  });

  it('rejects Node 18', () => {
    expect(() => assertSupportedNodeVersion('18.19.0')).toThrow(/Node 22\+/);
  });
});

describe('buildNodeArgsForServer', () => {
  it('enables sqlite flag on Node 22.x', () => {
    expect(buildNodeArgsForServer('/tmp/server.js', '22.22.1')).toEqual(['--experimental-sqlite', '/tmp/server.js']);
  });

  it('does not enable sqlite flag on Node 23+', () => {
    expect(buildNodeArgsForServer('/tmp/server.js', '23.5.0')).toEqual(['/tmp/server.js']);
  });

  it('does not enable sqlite flag on Node 25', () => {
    expect(buildNodeArgsForServer('/tmp/server.js', '25.5.0')).toEqual(['/tmp/server.js']);
  });
});
