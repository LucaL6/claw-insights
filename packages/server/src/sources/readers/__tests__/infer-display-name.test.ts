import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// We test inferDisplayName indirectly through the module's exported behavior.
// Since inferDisplayName is not exported, we import the file and test via parseSession behavior.
// For now, replicate the logic here to unit-test the priority chain.

function inferDisplayName(
  key: string,
  raw: { displayName?: string; label?: string },
): string {
  const displayName = raw.displayName?.trim();
  if (displayName) return displayName;
  const label = raw.label?.trim();
  if (label) return label;
  const parts = key.split(':');
  const last = parts[parts.length - 1];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(last) && parts.length > 1) {
    return parts[parts.length - 2] + ':' + last.slice(0, 8);
  }
  if (key.includes(':slack:')) {
    const slackIdx = parts.indexOf('slack');
    if (slackIdx >= 0 && slackIdx + 2 < parts.length) {
      return `slack:${parts[slackIdx + 1]}:${parts[slackIdx + 2]}`;
    }
  }
  return last;
}

describe('inferDisplayName priority', () => {
  it('uses displayName when present', () => {
    expect(
      inferDisplayName('agent:main:slack:channel:c08k1x9f2', {
        displayName: 'slack:#kanban-dev',
      }),
    ).toBe('slack:#kanban-dev');
  });

  it('falls back to label when displayName missing', () => {
    expect(
      inferDisplayName('agent:main:cron:abc', {
        label: 'Cron: tech-digest-daily',
      }),
    ).toBe('Cron: tech-digest-daily');
  });

  it('falls back to key-derived when both missing', () => {
    expect(inferDisplayName('agent:main:claw-insights-dev', {})).toBe('claw-insights-dev');
  });

  it('ignores whitespace-only displayName', () => {
    expect(
      inferDisplayName('agent:main:test', {
        displayName: '   ',
        label: 'fallback-label',
      }),
    ).toBe('fallback-label');
  });

  it('ignores whitespace-only label', () => {
    expect(
      inferDisplayName('agent:main:test', {
        label: '  ',
      }),
    ).toBe('test');
  });

  it('trims displayName', () => {
    expect(
      inferDisplayName('agent:main:x', { displayName: '  Luca  ' }),
    ).toBe('Luca');
  });

  it('handles subagent UUID keys', () => {
    expect(
      inferDisplayName('agent:main:subagent:a1b2c3d4-1111-4a7b-8c9d', {
        label: 'test-runner',
      }),
    ).toBe('test-runner');
  });

  it('handles subagent UUID fallback (no label)', () => {
    expect(
      inferDisplayName('agent:main:subagent:a1b2c3d4-1111-4a7b-8c9d', {}),
    ).toBe('subagent:a1b2c3d4');
  });

  it('handles slack DM key fallback', () => {
    expect(
      inferDisplayName('agent:main:slack:dm:u0acmuaf6ba', {}),
    ).toBe('slack:dm:u0acmuaf6ba');
  });
});
