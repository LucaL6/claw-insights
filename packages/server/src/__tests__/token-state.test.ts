import { describe, expect, it } from 'vitest';

import {
  computeDigest,
  createInitialTokenState,
  findCookieMatch,
  needsRotation,
  parseSessionCookie,
  rotateTokenState,
} from '../auth/token-state.js';

const HOUR = 60 * 60 * 1000;

describe('token-state', () => {
  it('computes deterministic digest from token and kid', () => {
    const digest1 = computeDigest('secret-token', 'k1');
    const digest2 = computeDigest('secret-token', 'k1');
    const digest3 = computeDigest('secret-token', 'k2');

    expect(digest1).toHaveLength(64);
    expect(digest1).toBe(digest2);
    expect(digest1).not.toBe(digest3);
  });

  it('initializes token state with defaults', () => {
    const now = 1_700_000_000_000;
    const state = createInitialTokenState('api-token', now);

    expect(state).toMatchObject({
      enabled: true,
      previous: [],
      lastRotatedAtMs: now,
      rotationIntervalMs: 24 * HOUR,
      graceMs: 12 * HOUR,
      maxPrevious: 2,
      version: 1,
    });
    expect(state.activeKid).toBeTruthy();
    expect(state.activeDigest).toBe(computeDigest('api-token', state.activeKid));
  });

  it('needsRotation respects 24h boundary', () => {
    const now = 1_700_000_000_000;
    const state = createInitialTokenState('api-token', now);

    expect(needsRotation(state, now + 24 * HOUR - 1)).toBe(false);
    expect(needsRotation(state, now + 24 * HOUR)).toBe(true);
  });

  it('rotateTokenState sets previous expiry to now + grace and clips previous list to maxPrevious', () => {
    const now = 1_700_000_000_000;
    const state = createInitialTokenState('api-token', now);

    let rotated = rotateTokenState(state, 'api-token', now + 24 * HOUR, {
      nextKid: 'k-1',
      maxPrevious: 2,
      graceMs: 12 * HOUR,
    });

    expect(rotated.previous[0]).toMatchObject({
      kid: state.activeKid,
      digest: state.activeDigest,
      expiresAtMs: now + 24 * HOUR + 12 * HOUR,
    });

    rotated = rotateTokenState(rotated, 'api-token', now + 25 * HOUR, {
      nextKid: 'k-2',
      maxPrevious: 2,
      graceMs: 12 * HOUR,
    });
    rotated = rotateTokenState(rotated, 'api-token', now + 26 * HOUR, {
      nextKid: 'k-3',
      maxPrevious: 2,
      graceMs: 12 * HOUR,
    });

    expect(rotated.previous).toHaveLength(2);
    expect(rotated.previous.map((p) => p.kid)).toEqual(['k-2', 'k-1']);
  });

  it('parseSessionCookie distinguishes parsed, malformed, and legacy formats', () => {
    expect(parseSessionCookie(undefined)).toEqual({ kind: 'none' });
    expect(parseSessionCookie('k-1:bad')).toEqual({ kind: 'malformed' });
    expect(parseSessionCookie('a'.repeat(64))).toEqual({ kind: 'legacy' });
    expect(parseSessionCookie(`k-1:${'b'.repeat(64)}`)).toEqual({
      kind: 'parsed',
      kid: 'k-1',
      digest: 'b'.repeat(64),
    });
  });

  it('findCookieMatch handles active, previous(valid), previous(expired), malformed, and legacy', () => {
    const now = 1_700_000_000_000;
    const state = createInitialTokenState('api-token', now);
    const rotated = rotateTokenState(state, 'api-token', now + 24 * HOUR, {
      nextKid: 'k-next',
      graceMs: 12 * HOUR,
      maxPrevious: 2,
    });

    expect(findCookieMatch(rotated, `${rotated.activeKid}:${rotated.activeDigest}`, now + 24 * HOUR + 1)).toEqual({
      kind: 'active',
      kid: rotated.activeKid,
      digest: rotated.activeDigest,
    });

    expect(findCookieMatch(rotated, `${state.activeKid}:${state.activeDigest}`, now + 24 * HOUR + 1)).toEqual({
      kind: 'previous',
      kid: state.activeKid,
      digest: state.activeDigest,
    });

    expect(
      findCookieMatch(rotated, `${state.activeKid}:${state.activeDigest}`, now + 24 * HOUR + 12 * HOUR + 1),
    ).toEqual({
      kind: 'none',
    });

    expect(findCookieMatch(rotated, 'bad-value', now)).toEqual({ kind: 'malformed' });
    expect(findCookieMatch(rotated, 'c'.repeat(64), now)).toEqual({ kind: 'legacy' });
  });
});
