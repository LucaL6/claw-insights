import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_MS = 12 * 60 * 60 * 1000;
const DEFAULT_MAX_PREVIOUS = 2;

export interface ApiTokenState {
  enabled: boolean;
  activeKid: string;
  activeDigest: string;
  previous: Array<{ kid: string; digest: string; expiresAtMs: number }>;
  lastRotatedAtMs: number;
  rotationIntervalMs: number;
  graceMs: number;
  maxPrevious: number;
  version: 1;
}

export interface RotateTokenStateOptions {
  nextKid?: string;
  rotationIntervalMs?: number;
  graceMs?: number;
  maxPrevious?: number;
}

export type CookieMatchResult =
  | { kind: 'active'; kid: string; digest: string }
  | { kind: 'previous'; kid: string; digest: string }
  | { kind: 'none' }
  | { kind: 'legacy' }
  | { kind: 'malformed' };

export type SessionCookieParseResult =
  | { kind: 'none' }
  | { kind: 'legacy' }
  | { kind: 'malformed' }
  | { kind: 'parsed'; kid: string; digest: string };

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function computeDigest(apiToken: string, kid: string): string {
  return createHash('sha256').update(`${kid}:${apiToken}`).digest('hex');
}

export function createInitialTokenState(apiToken: string, now: number): ApiTokenState {
  const activeKid = `k-${now}`;
  return {
    enabled: true,
    activeKid,
    activeDigest: computeDigest(apiToken, activeKid),
    previous: [],
    lastRotatedAtMs: now,
    rotationIntervalMs: DEFAULT_ROTATION_INTERVAL_MS,
    graceMs: DEFAULT_GRACE_MS,
    maxPrevious: DEFAULT_MAX_PREVIOUS,
    version: 1,
  };
}

export function needsRotation(state: ApiTokenState, now: number): boolean {
  if (!state.enabled) {
    return false;
  }
  return now - state.lastRotatedAtMs >= state.rotationIntervalMs;
}

export function rotateTokenState(
  state: ApiTokenState,
  apiToken: string,
  now: number,
  options: RotateTokenStateOptions = {},
): ApiTokenState {
  const graceMs = options.graceMs ?? state.graceMs;
  const maxPrevious = options.maxPrevious ?? state.maxPrevious;
  const rotationIntervalMs = options.rotationIntervalMs ?? state.rotationIntervalMs;
  const nextKid = options.nextKid ?? `k-${now}`;

  const previous = [
    { kid: state.activeKid, digest: state.activeDigest, expiresAtMs: now + graceMs },
    ...state.previous.filter((item) => item.expiresAtMs > now),
  ].slice(0, maxPrevious);

  return {
    enabled: state.enabled,
    activeKid: nextKid,
    activeDigest: computeDigest(apiToken, nextKid),
    previous,
    lastRotatedAtMs: now,
    rotationIntervalMs,
    graceMs,
    maxPrevious,
    version: 1,
  };
}

export function parseSessionCookie(cookieValue: string | undefined): SessionCookieParseResult {
  if (!cookieValue) {
    return { kind: 'none' };
  }

  if (/^[a-f0-9]{64}$/i.test(cookieValue)) {
    return { kind: 'legacy' };
  }

  const colonIndex = cookieValue.indexOf(':');
  if (colonIndex <= 0 || colonIndex !== cookieValue.lastIndexOf(':') || colonIndex >= cookieValue.length - 1) {
    return { kind: 'malformed' };
  }

  const kid = cookieValue.slice(0, colonIndex);
  const digest = cookieValue.slice(colonIndex + 1);
  if (!/^[a-f0-9]{64}$/i.test(digest)) {
    return { kind: 'malformed' };
  }

  return { kind: 'parsed', kid, digest };
}

export function findCookieMatch(state: ApiTokenState, cookieValue: string | undefined, now: number): CookieMatchResult {
  const parsed = parseSessionCookie(cookieValue);
  if (parsed.kind === 'none' || parsed.kind === 'legacy' || parsed.kind === 'malformed') {
    return parsed;
  }

  if (parsed.kid === state.activeKid && safeEqual(parsed.digest, state.activeDigest)) {
    return { kind: 'active', kid: parsed.kid, digest: parsed.digest };
  }

  const previous = state.previous.find(
    (item) => item.kid === parsed.kid && safeEqual(parsed.digest, item.digest) && item.expiresAtMs > now,
  );
  if (previous) {
    return { kind: 'previous', kid: parsed.kid, digest: parsed.digest };
  }

  return { kind: 'none' };
}
