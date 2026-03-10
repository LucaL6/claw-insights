import { existsSync, readFileSync } from 'node:fs';

import { createChildLogger } from '../logger.js';
import { migrateLegacyApiTokenToSecret, readAuthSecret, writeAuthSecret } from './secret-store.js';
import { type ApiTokenState,needsRotation, rotateTokenState } from './token-state.js';
import { loadOrInitTokenState, persistTokenStateAtomic } from './token-state-store.js';

const log = createChildLogger('auth:rotation-runner');

const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_REQUEST_THROTTLE_MS = 30 * 1000;

export type InstallationState = 'fresh' | 'migrating' | 'initialized';
export type RotationTrigger = 'startup' | 'timer' | 'request' | 'manual';

export interface RotationPolicyOptions {
  rotationIntervalMs?: number;
  graceMs?: number;
  maxPrevious?: number;
}

export interface InitializeAuthRuntimeOptions extends RotationPolicyOptions {
  configPath: string;
  secretPath: string;
  envApiToken?: string;
  nowMs?: number;
  generateToken?: () => string;
  loadState?: (configPath: string, apiToken: string, nowMs: number) => ApiTokenState;
  persistState?: (configPath: string, next: ApiTokenState) => void;
}

export interface InitializedAuthRuntime {
  apiToken: string;
  installationState: InstallationState;
  tokenState: ApiTokenState;
}

interface ReadConfigResult {
  raw: Record<string, unknown>;
  hasLegacyApiToken: boolean;
  hasApiTokenState: boolean;
}

function readConfig(configPath: string): ReadConfigResult {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
    const raw = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    const hasLegacyApiToken = typeof raw.apiToken === 'string' && raw.apiToken.trim().length > 0;
    const hasApiTokenState = typeof raw.apiTokenState === 'object' && raw.apiTokenState !== null;
    return { raw, hasLegacyApiToken, hasApiTokenState };
  } catch {
    return { raw: {}, hasLegacyApiToken: false, hasApiTokenState: false };
  }
}

export function classifyInstallationState(configPath: string, secretPath: string): InstallationState {
  const hasSecret = existsSync(secretPath);
  const { hasLegacyApiToken, hasApiTokenState } = readConfig(configPath);

  if (!hasSecret && hasLegacyApiToken) {
    return 'migrating';
  }
  if (!hasSecret && !hasApiTokenState && !hasLegacyApiToken) {
    return 'fresh';
  }
  return 'initialized';
}

function failFastMissingSecret(secretPath: string): never {
  throw new Error(
    `auth-secret missing for initialized install: ${secretPath}. ` +
      `Restore ~/.claw-insights/auth-secret (or re-bootstrap as fresh install).`,
  );
}

function readSecretOrFailFast(secretPath: string): string {
  try {
    return readAuthSecret(secretPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    throw new Error(
      `auth-secret is missing/corrupt at ${secretPath}. ` + `Fix ~/.claw-insights/auth-secret and restart. (${reason})`,
    );
  }
}

function applyRotationPolicy(state: ApiTokenState, policy: RotationPolicyOptions): ApiTokenState {
  const rotationIntervalMs = policy.rotationIntervalMs ?? state.rotationIntervalMs;
  const graceMs = policy.graceMs ?? state.graceMs;
  const maxPrevious = policy.maxPrevious ?? state.maxPrevious;

  const trimmedPrevious = state.previous.slice(0, maxPrevious);

  if (
    rotationIntervalMs === state.rotationIntervalMs &&
    graceMs === state.graceMs &&
    maxPrevious === state.maxPrevious &&
    trimmedPrevious.length === state.previous.length
  ) {
    return state;
  }

  return {
    ...state,
    rotationIntervalMs,
    graceMs,
    maxPrevious,
    previous: trimmedPrevious,
  };
}

export function initializeAuthRuntime(options: InitializeAuthRuntimeOptions): InitializedAuthRuntime {
  const nowMs = options.nowMs ?? Date.now();
  const loadState = options.loadState ?? loadOrInitTokenState;
  const persistState = options.persistState ?? persistTokenStateAtomic;
  const generateToken =
    options.generateToken ??
    (() => {
      throw new Error('initializeAuthRuntime requires generateToken when no env/secret/legacy token exists');
    });

  const installationState = classifyInstallationState(options.configPath, options.secretPath);

  if (installationState === 'initialized' && !existsSync(options.secretPath)) {
    failFastMissingSecret(options.secretPath);
  }

  if (installationState === 'migrating') {
    const migrated = migrateLegacyApiTokenToSecret(options.configPath, options.secretPath);
    if (migrated !== 'migrated' && !existsSync(options.secretPath)) {
      failFastMissingSecret(options.secretPath);
    }
  }

  if (installationState === 'fresh' && !existsSync(options.secretPath)) {
    const bootstrapToken = options.envApiToken ?? generateToken();
    writeAuthSecret(options.secretPath, bootstrapToken);
  }

  const secretToken = existsSync(options.secretPath) ? readSecretOrFailFast(options.secretPath) : undefined;
  if (!secretToken && installationState === 'initialized') {
    failFastMissingSecret(options.secretPath);
  }

  const apiToken = options.envApiToken ?? secretToken;
  if (!apiToken) {
    throw new Error('unable to resolve apiToken from env/auth-secret/legacy/fresh bootstrap');
  }

  const loadedState = loadState(options.configPath, apiToken, nowMs);
  const tokenState = applyRotationPolicy(loadedState, {
    rotationIntervalMs: options.rotationIntervalMs,
    graceMs: options.graceMs,
    maxPrevious: options.maxPrevious,
  });
  persistState(options.configPath, tokenState);

  return {
    apiToken,
    installationState,
    tokenState,
  };
}

export interface RotationRunnerOptions extends RotationPolicyOptions {
  apiToken: string;
  configPath: string;
  enabled?: boolean;
  checkIntervalMs?: number;
  requestThrottleMs?: number;
  now?: () => number;
  loadState?: (nowMs: number) => ApiTokenState;
  persistState?: (next: ApiTokenState) => void | Promise<void>;
  needsRotationFn?: (state: ApiTokenState, nowMs: number) => boolean;
  rotateState?: (state: ApiTokenState, apiToken: string, nowMs: number) => ApiTokenState;
  setIntervalFn?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (id: ReturnType<typeof setInterval>) => void;
  onError?: (error: unknown, reason: RotationTrigger) => void;
}

export class SessionRotationRunner {
  private readonly apiToken: string;
  private readonly configPath: string;
  private readonly enabled: boolean;
  private readonly checkIntervalMs: number;
  private readonly requestThrottleMs: number;
  private readonly rotationIntervalMs: number | undefined;
  private readonly graceMs: number | undefined;
  private readonly maxPrevious: number | undefined;
  private readonly now: () => number;
  private readonly loadState: (nowMs: number) => ApiTokenState;
  private readonly persistState: (next: ApiTokenState) => void | Promise<void>;
  private readonly needsRotationFn: (state: ApiTokenState, nowMs: number) => boolean;
  private readonly rotateState: (state: ApiTokenState, apiToken: string, nowMs: number) => ApiTokenState;
  private readonly setIntervalFn: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  private readonly clearIntervalFn: (id: ReturnType<typeof setInterval>) => void;
  private readonly onError: ((error: unknown, reason: RotationTrigger) => void) | undefined;

  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<boolean> | null = null;
  private lastRequestCheckAt = 0;

  constructor(options: RotationRunnerOptions) {
    this.apiToken = options.apiToken;
    this.configPath = options.configPath;
    this.enabled = options.enabled ?? true;
    this.checkIntervalMs = options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    this.requestThrottleMs = options.requestThrottleMs ?? DEFAULT_REQUEST_THROTTLE_MS;
    this.rotationIntervalMs = options.rotationIntervalMs;
    this.graceMs = options.graceMs;
    this.maxPrevious = options.maxPrevious;
    this.now = options.now ?? (() => Date.now());
    this.loadState = options.loadState ?? ((nowMs) => loadOrInitTokenState(this.configPath, this.apiToken, nowMs));
    this.persistState = options.persistState ?? ((next) => persistTokenStateAtomic(this.configPath, next));
    this.needsRotationFn = options.needsRotationFn ?? needsRotation;
    this.rotateState = options.rotateState ?? rotateTokenState;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
    this.onError = options.onError;
  }

  start(): void {
    if (!this.enabled) {
      return;
    }

    void this.maybeRotate('startup').catch((error) => {
      this.onError?.(error, 'startup');
      log.warn({ err: error }, 'startup rotation check failed');
    });

    if (this.timer) {
      return;
    }

    this.timer = this.setIntervalFn(() => {
      void this.maybeRotate('timer').catch((error) => {
        this.onError?.(error, 'timer');
        log.warn({ err: error }, 'timer rotation check failed');
      });
    }, this.checkIntervalMs);

    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    this.clearIntervalFn(this.timer);
    this.timer = null;
  }

  async waitForIdle(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight.catch(() => undefined);
    }
  }

  async triggerRequestFallback(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const nowMs = this.now();
    if (nowMs - this.lastRequestCheckAt < this.requestThrottleMs) {
      return false;
    }
    this.lastRequestCheckAt = nowMs;

    try {
      return await this.maybeRotate('request');
    } catch (error) {
      this.onError?.(error, 'request');
      log.warn({ err: error }, 'request fallback rotation check failed');
      return false;
    }
  }

  maybeRotate(reason: RotationTrigger = 'manual'): Promise<boolean> {
    if (!this.enabled) {
      return Promise.resolve(false);
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const task = (async () => {
      const nowMs = this.now();
      const loadedState = this.loadState(nowMs);
      const state = applyRotationPolicy(loadedState, {
        rotationIntervalMs: this.rotationIntervalMs,
        graceMs: this.graceMs,
        maxPrevious: this.maxPrevious,
      });

      if (!this.needsRotationFn(state, nowMs)) {
        if (state !== loadedState) {
          await this.persistState(state);
        }
        return false;
      }

      const next = this.rotateState(state, this.apiToken, nowMs);
      await this.persistState(next);
      log.info({ reason, kid: next.activeKid }, 'session token state rotated');
      return true;
    })()
      .catch((error) => {
        this.onError?.(error, reason);
        throw error;
      })
      .finally(() => {
        this.inFlight = null;
      });

    this.inFlight = task;
    return task;
  }
}

export function createRotationRunner(options: RotationRunnerOptions): SessionRotationRunner {
  return new SessionRotationRunner(options);
}

let activeAuthRunner: SessionRotationRunner | null = null;

export function setAuthRotationRunner(runner: SessionRotationRunner | null): void {
  activeAuthRunner = runner;
}

export function triggerAuthRotationFallbackCheck(): void {
  if (!activeAuthRunner) {
    return;
  }
  void activeAuthRunner.triggerRequestFallback();
}
