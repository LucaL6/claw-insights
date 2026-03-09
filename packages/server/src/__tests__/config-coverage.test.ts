import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../logger.js', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    logger: mockLogger,
    createChildLogger: vi.fn(() => mockLogger),
  };
});

let tmpHome: string;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'cfg-test-'));
  savedEnv.HOME = process.env.HOME;
  savedEnv.CLAW_INSIGHTS_CLI = process.env.CLAW_INSIGHTS_CLI;
  savedEnv.OPENCLAW_CLI = process.env.OPENCLAW_CLI;
  process.env.HOME = tmpHome;
  delete process.env.CLAW_INSIGHTS_CLI;
  delete process.env.OPENCLAW_CLI;
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = savedEnv.HOME;
  if (savedEnv.CLAW_INSIGHTS_CLI !== undefined) {
    process.env.CLAW_INSIGHTS_CLI = savedEnv.CLAW_INSIGHTS_CLI;
  } else {
    delete process.env.CLAW_INSIGHTS_CLI;
  }
  if (savedEnv.OPENCLAW_CLI !== undefined) {
    process.env.OPENCLAW_CLI = savedEnv.OPENCLAW_CLI;
  } else {
    delete process.env.OPENCLAW_CLI;
  }
  try {
    rmSync(tmpHome, { recursive: true });
  } catch {
    /* ignore */
  }
});

describe('loadConfigFile', () => {
  it('returns {} when config.json does not exist', async () => {
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
  });

  it('returns {} when JSON is null', async () => {
    const dir = join(tmpHome, '.claw-insights');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), 'null');
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
  });

  it('returns {} for invalid JSON', async () => {
    const dir = join(tmpHome, '.claw-insights');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), '{bad json!!}');
    const { loadConfigFile } = await import('../config.js');
    expect(loadConfigFile()).toEqual({});
  });

  it('returns parsed object for valid config', async () => {
    const dir = join(tmpHome, '.claw-insights');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), '{"serverPort": 9999}');
    const { loadConfigFile } = await import('../config.js');
    const cfg = loadConfigFile();
    expect(cfg.serverPort).toBe(9999);
  });
});

describe('detectCliPath', () => {
  it('returns env var when CLAW_INSIGHTS_CLI is set', async () => {
    process.env.CLAW_INSIGHTS_CLI = '/custom/cli';
    const { detectCliPath } = await import('../config.js');
    expect(detectCliPath()).toBe('/custom/cli');
  });

  it('falls back to OPENCLAW_CLI', async () => {
    process.env.OPENCLAW_CLI = '/other/cli';
    const { detectCliPath } = await import('../config.js');
    expect(detectCliPath()).toBe('/other/cli');
  });
});
