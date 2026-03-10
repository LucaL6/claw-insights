import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRotationRunner, initializeAuthRuntime, type RotationTrigger } from '../auth/rotation-runner.js';
import { type ApiTokenState,createInitialTokenState } from '../auth/token-state.js';

describe('initializeAuthRuntime', () => {
  let dir: string;
  let configPath: string;
  let secretPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rotation-init-'));
    mkdirSync(dir, { recursive: true });
    configPath = join(dir, 'config.json');
    secretPath = join(dir, 'auth-secret');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('migrates legacy config.apiToken into auth-secret on startup', () => {
    const legacyToken = 'l'.repeat(32);
    writeFileSync(configPath, JSON.stringify({ apiToken: legacyToken, keep: true }, null, 2));

    const runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_000_000,
      generateToken: () => 'g'.repeat(32),
    });

    expect(runtime.installationState).toBe('migrating');
    expect(runtime.apiToken).toBe(legacyToken);

    const secret = readFileSync(secretPath, 'utf-8').trim();
    expect(secret).toBe(legacyToken);

    const savedConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(savedConfig.apiToken).toBeUndefined();
    expect(savedConfig.keep).toBe(true);
    expect(savedConfig.apiTokenState).toBeDefined();
  });

  it('first boot with no secret and no state bootstraps token + state', () => {
    const runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_000_000,
      generateToken: () => 'f'.repeat(32),
    });

    expect(runtime.installationState).toBe('fresh');
    expect(runtime.apiToken).toBe('f'.repeat(32));

    const secret = readFileSync(secretPath, 'utf-8').trim();
    expect(secret).toBe('f'.repeat(32));

    const savedConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(savedConfig.apiTokenState).toBeDefined();
  });

  it('fails fast when initialized install is missing auth-secret', () => {
    const state = createInitialTokenState('x'.repeat(32), 1_700_000_000_000);
    writeFileSync(configPath, JSON.stringify({ apiTokenState: state }, null, 2));

    expect(() =>
      initializeAuthRuntime({
        configPath,
        secretPath,
        nowMs: 1_700_000_100_000,
        generateToken: () => 'f'.repeat(32),
      }),
    ).toThrow(/auth-secret missing/i);
  });

  it('fails fast when initialized install has corrupt auth-secret', () => {
    const state = createInitialTokenState('x'.repeat(32), 1_700_000_000_000);
    writeFileSync(configPath, JSON.stringify({ apiTokenState: state }, null, 2));
    writeFileSync(secretPath, '\n');

    expect(() =>
      initializeAuthRuntime({
        configPath,
        secretPath,
        nowMs: 1_700_000_100_000,
        generateToken: () => 'f'.repeat(32),
      }),
    ).toThrow(/auth-secret/i);
  });

  it('honors token precedence: env > auth-secret > legacy > generated(fresh)', () => {
    const envToken = 'e'.repeat(32);
    const secretToken = 's'.repeat(32);
    const legacyToken = 'l'.repeat(32);

    // env > secret
    writeFileSync(secretPath, secretToken);
    writeFileSync(configPath, JSON.stringify({ apiToken: legacyToken }, null, 2));
    let runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      envApiToken: envToken,
      nowMs: 1_700_000_000_000,
      generateToken: () => 'g'.repeat(32),
    });
    expect(runtime.apiToken).toBe(envToken);

    // secret > legacy
    runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_100_000,
      generateToken: () => 'g'.repeat(32),
    });
    expect(runtime.apiToken).toBe(secretToken);

    // legacy (migrating)
    rmSync(secretPath, { force: true });
    writeFileSync(configPath, JSON.stringify({ apiToken: legacyToken }, null, 2));
    runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_200_000,
      generateToken: () => 'g'.repeat(32),
    });
    expect(runtime.apiToken).toBe(legacyToken);

    // generated (fresh)
    rmSync(secretPath, { force: true });
    rmSync(configPath, { force: true });
    runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_300_000,
      generateToken: () => 'g'.repeat(32),
    });
    expect(runtime.apiToken).toBe('g'.repeat(32));
  });

  it('applies rotation policy overrides during runtime initialization', () => {
    const persistState = vi.fn<(configPath: string, next: ApiTokenState) => void>();

    const runtime = initializeAuthRuntime({
      configPath,
      secretPath,
      nowMs: 1_700_000_000_000,
      generateToken: () => 't'.repeat(32),
      rotationIntervalMs: 60_000,
      graceMs: 30_000,
      maxPrevious: 1,
      persistState,
    });

    expect(runtime.tokenState.rotationIntervalMs).toBe(60_000);
    expect(runtime.tokenState.graceMs).toBe(30_000);
    expect(runtime.tokenState.maxPrevious).toBe(1);

    const persistedState = persistState.mock.calls.at(-1)?.[1];
    expect(persistedState?.rotationIntervalMs).toBe(60_000);
    expect(persistedState?.graceMs).toBe(30_000);
    expect(persistedState?.maxPrevious).toBe(1);
  });
});

describe('rotation runner', () => {
  it('timer-driven check rotates after interval', async () => {
    let now = 1_700_000_000_000;
    let current = createInitialTokenState('t'.repeat(32), now);
    current.rotationIntervalMs = 1000;

    let timerCallback: () => void = () => {
      throw new Error('timer callback not registered');
    };
    let persistCalls = 0;

    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      checkIntervalMs: 300_000,
      now: () => now,
      loadState: () => current,
      persistState: (next) => {
        persistCalls += 1;
        current = next;
      },
      setIntervalFn: (fn) => {
        timerCallback = fn;
        return 1 as unknown as NodeJS.Timeout;
      },
      clearIntervalFn: vi.fn(),
    });

    runner.start();

    await runner.waitForIdle(); // startup check settles first

    now += 1_500;
    timerCallback();
    await runner.waitForIdle();

    expect(persistCalls).toBe(1);
    expect(current.previous.length).toBe(1);
  });

  it('concurrent timer + request fallback checks are single-flight', async () => {
    const now = 1_700_000_000_000;
    const current = createInitialTokenState('t'.repeat(32), now - 10_000);
    current.rotationIntervalMs = 1000;

    let resolvePersist: () => void = () => {
      throw new Error('persist resolver not captured');
    };
    let persistCalls = 0;

    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      now: () => now,
      requestThrottleMs: 0,
      loadState: () => current,
      persistState: async () => {
        persistCalls += 1;
        await new Promise<void>((resolve) => {
          resolvePersist = resolve;
        });
      },
    });

    const timerPromise = runner.maybeRotate('timer');
    const requestPromise = runner.triggerRequestFallback();

    expect(persistCalls).toBe(1);
    resolvePersist();

    await Promise.all([timerPromise, requestPromise]);
    expect(persistCalls).toBe(1);
  });

  it('failed rotate releases in-flight guard so next check can retry', async () => {
    const now = 1_700_000_000_000;
    let current = createInitialTokenState('t'.repeat(32), now - 10_000);
    current.rotationIntervalMs = 1000;

    let persistCalls = 0;
    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      now: () => now,
      loadState: () => current,
      persistState: (next) => {
        persistCalls += 1;
        if (persistCalls === 1) {
          throw new Error('boom');
        }
        current = next;
      },
    });

    await expect(runner.maybeRotate('timer')).rejects.toThrow('boom');
    await expect(runner.maybeRotate('timer')).resolves.toBe(true);
    expect(persistCalls).toBe(2);
  });

  it('request fallback throttle is respected (<= once per 30s by default)', async () => {
    let now = 1_700_000_000_000;
    const current = createInitialTokenState('t'.repeat(32), now);
    current.rotationIntervalMs = 10_000_000; // no rotation needed

    let loadCalls = 0;
    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      now: () => now,
      loadState: () => {
        loadCalls += 1;
        return current;
      },
      persistState: vi.fn(),
    });

    await runner.triggerRequestFallback(); // run
    await runner.triggerRequestFallback(); // throttled
    now += 31_000;
    await runner.triggerRequestFallback(); // run

    expect(loadCalls).toBe(2);
  });

  it('consumes rotation policy overrides from runtime config', async () => {
    const now = 1_700_000_000_000;
    let current = createInitialTokenState('t'.repeat(32), now - 2_000);
    current.rotationIntervalMs = 10_000; // would not rotate without override
    current.graceMs = 5_000;
    current.maxPrevious = 3;

    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      now: () => now,
      rotationIntervalMs: 1_000,
      graceMs: 200,
      maxPrevious: 1,
      loadState: () => current,
      persistState: (next) => {
        current = next;
      },
    });

    await expect(runner.maybeRotate('timer')).resolves.toBe(true);
    expect(current.rotationIntervalMs).toBe(1_000);
    expect(current.graceMs).toBe(200);
    expect(current.maxPrevious).toBe(1);
    expect(current.previous).toHaveLength(1);
    expect(current.previous[0]?.expiresAtMs).toBe(now + 200);
  });

  it('supports disabling rotation runner', async () => {
    const loadState = vi.fn<() => ApiTokenState>(() => createInitialTokenState('t'.repeat(32), Date.now()));

    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      enabled: false,
      loadState,
      persistState: vi.fn(),
    });

    await expect(runner.maybeRotate('startup')).resolves.toBe(false);
    await expect(runner.triggerRequestFallback()).resolves.toBe(false);
    expect(loadState).not.toHaveBeenCalled();
  });

  it('exposes trigger reason to error handler', async () => {
    const errors: RotationTrigger[] = [];
    const now = 1_700_000_000_000;
    const current = createInitialTokenState('t'.repeat(32), now - 10_000);
    current.rotationIntervalMs = 1;

    const runner = createRotationRunner({
      apiToken: 't'.repeat(32),
      configPath: '/tmp/config.json',
      now: () => now,
      loadState: () => current,
      persistState: () => {
        throw new Error('persist failed');
      },
      onError: (_error, reason) => {
        errors.push(reason);
      },
    });

    await expect(runner.maybeRotate('timer')).rejects.toThrow(/persist failed/);
    expect(errors).toEqual(['timer']);
  });
});
