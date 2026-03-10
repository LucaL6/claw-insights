import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ApiTokenState } from '../auth/token-state.js';
import { createInitialTokenState } from '../auth/token-state.js';
import { loadOrInitTokenState, persistTokenStateAtomic } from '../auth/token-state-store.js';

const HOUR = 60 * 60 * 1000;

describe('token-state-store', () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'token-state-store-'));
    mkdirSync(dir, { recursive: true });
    configPath = join(dir, 'config.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads valid apiTokenState', () => {
    const now = 1_700_000_000_000;
    const state = createInitialTokenState('token-1', now);
    writeFileSync(configPath, JSON.stringify({ apiTokenState: state, keep: 'x' }, null, 2));

    const loaded = loadOrInitTokenState(configPath, 'token-1', now + 1);
    expect(loaded).toEqual(state);
  });

  it('re-initializes state when apiTokenState is missing', () => {
    const now = 1_700_000_000_000;
    writeFileSync(configPath, JSON.stringify({ keep: 1 }, null, 2));

    const loaded = loadOrInitTokenState(configPath, 'token-2', now);

    expect(loaded.version).toBe(1);
    expect(loaded.activeDigest).toBeTruthy();
    expect(loaded.lastRotatedAtMs).toBe(now);
    expect(loaded.previous).toEqual([]);
  });

  it('re-initializes state when apiTokenState is malformed', () => {
    const now = 1_700_000_000_000;
    writeFileSync(configPath, JSON.stringify({ apiTokenState: { bad: true } }, null, 2));

    const loaded = loadOrInitTokenState(configPath, 'token-3', now);

    expect(loaded.version).toBe(1);
    expect(loaded.lastRotatedAtMs).toBe(now);
    expect(loaded.previous).toEqual([]);
  });

  it('prunes expired previous entries on load', () => {
    const now = 1_700_000_000_000;
    const state: ApiTokenState = {
      ...createInitialTokenState('token-4', now - 1000),
      previous: [
        { kid: 'old-expired', digest: 'a'.repeat(64), expiresAtMs: now - 1 },
        { kid: 'old-live', digest: 'b'.repeat(64), expiresAtMs: now + HOUR },
      ],
    };
    writeFileSync(configPath, JSON.stringify({ apiTokenState: state }, null, 2));

    const loaded = loadOrInitTokenState(configPath, 'token-4', now);

    expect(loaded.previous).toEqual([{ kid: 'old-live', digest: 'b'.repeat(64), expiresAtMs: now + HOUR }]);
  });

  it('persists token state atomically and preserves unrelated keys', () => {
    const now = 1_700_000_000_000;
    writeFileSync(configPath, JSON.stringify({ keep: 'me', nested: { a: 1 } }, null, 2));

    const next = createInitialTokenState('token-5', now);
    persistTokenStateAtomic(configPath, next);

    const saved = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(saved.keep).toBe('me');
    expect(saved.nested).toEqual({ a: 1 });
    expect(saved.apiTokenState).toEqual(next);

    // tmp file should not remain after successful rename
    expect(() => readFileSync(`${configPath}.tmp`, 'utf-8')).toThrow();
  });
});
