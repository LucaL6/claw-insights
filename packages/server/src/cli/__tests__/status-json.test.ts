import { describe, expect, it } from 'vitest';

import { buildStatusJson } from '../status-json.js';

describe('buildStatusJson', () => {
  it('builds running payload with schemaVersion 1', () => {
    expect(
      buildStatusJson({
        version: '0.1.1',
        server: { state: 'running', pid: 123, port: 41041, url: 'http://localhost:41041' },
        web: { enabled: true, port: 41042, url: 'http://localhost:41042' },
        auth: { mode: 'token-cookie', tokenUrlPresent: true, accessUrl: 'http://localhost:41041/?token=abc' },
        health: { ok: true, ready: true, gateway: 'connected', db: 'ok', warnings: [] },
      }),
    ).toMatchObject({
      schemaVersion: 1,
      version: '0.1.1',
      server: { state: 'running', pid: 123, port: 41041, url: 'http://localhost:41041' },
      web: { enabled: true, port: 41042, url: 'http://localhost:41042' },
      auth: { mode: 'token-cookie', tokenUrlPresent: true, accessUrl: 'http://localhost:41041/?token=abc' },
      health: { ok: true, ready: true, gateway: 'connected', db: 'ok', warnings: [] },
    });
  });

  it('keeps degraded/stopped states', () => {
    expect(
      buildStatusJson({
        version: '0.1.1',
        server: { state: 'degraded', pid: 123, port: 41041, url: 'http://localhost:41041' },
        web: { enabled: false, port: 41042, url: 'http://localhost:41042' },
        auth: { mode: 'token-cookie', tokenUrlPresent: false, accessUrl: null },
        health: { ok: false, ready: false, gateway: 'disconnected', db: 'error', warnings: [] },
      }).server.state,
    ).toBe('degraded');

    expect(
      buildStatusJson({
        version: '0.1.1',
        server: { state: 'stopped', pid: null, port: 41041, url: 'http://localhost:41041' },
        web: { enabled: false, port: 41042, url: 'http://localhost:41042' },
        auth: { mode: 'token-cookie', tokenUrlPresent: false, accessUrl: null },
        health: { ok: false, ready: false, gateway: 'disconnected', db: 'unknown', warnings: [] },
      }).server.state,
    ).toBe('stopped');
  });

  it('adds warning when version is unknown', () => {
    const payload = buildStatusJson({
      version: 'unknown',
      server: { state: 'running', pid: 123, port: 41041, url: 'http://localhost:41041' },
      web: { enabled: true, port: 41042, url: 'http://localhost:41042' },
      auth: { mode: 'token-cookie', tokenUrlPresent: true, accessUrl: 'http://localhost:41041/?token=abc' },
      health: { ok: true, ready: true, gateway: 'connected', db: 'ok', warnings: [] },
    });

    expect(payload.health.warnings).toContain('cli version is unknown');
  });

  it('tolerates unknown additive fields for consumer parse', () => {
    const payload = buildStatusJson({
      version: '0.1.1',
      server: { state: 'running', pid: 123, port: 41041, url: 'http://localhost:41041' },
      web: { enabled: true, port: 41042, url: 'http://localhost:41042' },
      auth: { mode: 'token-cookie', tokenUrlPresent: true, accessUrl: 'http://localhost:41041/?token=abc' },
      health: { ok: true, ready: true, gateway: 'connected', db: 'ok', warnings: [] },
    }) as unknown as Record<string, unknown>;

    payload.extra = { foo: 'bar' };
    const parsed = JSON.parse(JSON.stringify(payload)) as { schemaVersion: number; server: { state: string } };

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.server.state).toBe('running');
  });
});
