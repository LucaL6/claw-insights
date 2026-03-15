import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getDataDir } from '../paths.js';

describe('getDataDir', () => {
  const originalHome = process.env.CLAW_INSIGHTS_HOME;

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.CLAW_INSIGHTS_HOME;
    } else {
      process.env.CLAW_INSIGHTS_HOME = originalHome;
    }
  });

  it('returns default path when CLAW_INSIGHTS_HOME is not set', () => {
    delete process.env.CLAW_INSIGHTS_HOME;
    expect(getDataDir()).toBe(join(homedir(), '.claw-insights'));
  });

  it('returns CLAW_INSIGHTS_HOME when set', () => {
    process.env.CLAW_INSIGHTS_HOME = '/tmp/test-claw';
    expect(getDataDir()).toBe('/tmp/test-claw');
  });

  it('returns an absolute path by default', () => {
    delete process.env.CLAW_INSIGHTS_HOME;
    expect(getDataDir()).toMatch(/^\//);
  });

  it('ignores empty string and falls back to default', () => {
    process.env.CLAW_INSIGHTS_HOME = '';
    expect(getDataDir()).toBe(join(homedir(), '.claw-insights'));
  });

  it('ignores whitespace-only value and falls back to default', () => {
    process.env.CLAW_INSIGHTS_HOME = '   ';
    expect(getDataDir()).toBe(join(homedir(), '.claw-insights'));
  });

  it('ignores relative path and falls back to default', () => {
    process.env.CLAW_INSIGHTS_HOME = 'relative/path';
    expect(getDataDir()).toBe(join(homedir(), '.claw-insights'));
  });
});
