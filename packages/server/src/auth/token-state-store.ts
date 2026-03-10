import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import type { ApiTokenState } from './token-state.js';
import { createInitialTokenState } from './token-state.js';

function isPreviousEntry(value: unknown): value is { kid: string; digest: string; expiresAtMs: number } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.kid === 'string' &&
    typeof entry.digest === 'string' &&
    typeof entry.expiresAtMs === 'number' &&
    Number.isFinite(entry.expiresAtMs)
  );
}

function isApiTokenState(value: unknown): value is ApiTokenState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const state = value as Record<string, unknown>;
  return (
    typeof state.enabled === 'boolean' &&
    typeof state.activeKid === 'string' &&
    typeof state.activeDigest === 'string' &&
    Array.isArray(state.previous) &&
    state.previous.every(isPreviousEntry) &&
    typeof state.lastRotatedAtMs === 'number' &&
    Number.isFinite(state.lastRotatedAtMs) &&
    typeof state.rotationIntervalMs === 'number' &&
    Number.isFinite(state.rotationIntervalMs) &&
    typeof state.graceMs === 'number' &&
    Number.isFinite(state.graceMs) &&
    typeof state.maxPrevious === 'number' &&
    Number.isFinite(state.maxPrevious) &&
    state.version === 1
  );
}

function readConfigObject(configPath: string): Record<string, unknown> {
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function loadOrInitTokenState(configPath: string, apiToken: string, nowMs: number): ApiTokenState {
  const cfg = readConfigObject(configPath);
  const maybeState = cfg.apiTokenState;
  if (!isApiTokenState(maybeState)) {
    return createInitialTokenState(apiToken, nowMs);
  }

  const previous = maybeState.previous.filter((entry) => entry.expiresAtMs > nowMs);
  if (previous.length === maybeState.previous.length) {
    return maybeState;
  }

  return {
    ...maybeState,
    previous,
  };
}

export function persistTokenStateAtomic(configPath: string, next: ApiTokenState): void {
  const cfg = readConfigObject(configPath);
  const out = {
    ...cfg,
    apiTokenState: next,
  };

  const tmpPath = `${configPath}.tmp`;
  const payload = `${JSON.stringify(out, null, 2)}\n`;

  const fd = openSync(tmpPath, 'w', 0o600);
  try {
    writeFileSync(fd, payload, 'utf-8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }

  renameSync(tmpPath, configPath);
}
