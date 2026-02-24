import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURE_PATH = resolve(__dirname, '../../../../../../sandbox/fixtures/sessions.json');

interface RawSession {
  model: string;
  totalTokens: number;
  contextTokens: number;
  spawnedBy?: string;
  chatType?: string | null;
  label?: string;
}

function loadSessions(): Record<string, RawSession> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('demo session fixture realism', () => {
  const sessions = loadSessions();
  const entries = Object.entries(sessions);
  const values = Object.values(sessions);

  it('should have 10 sessions (4 top-level + 6 sub-agents)', () => {
    expect(entries.length).toBe(10);
    const topLevel = values.filter((s) => !s.spawnedBy);
    const subAgents = values.filter((s) => s.spawnedBy);
    expect(topLevel.length).toBe(4);
    expect(subAgents.length).toBe(6);
  });

  it('should use only 3 models with Codex 5.3 as primary', () => {
    const models = new Set(values.map((s) => s.model));
    expect(models.size).toBe(3);
    expect(models).toContain('gpt-5.3-codex');
    expect(models).toContain('gpt-5.2-codex');
    expect(models).toContain('MiniMax-M2.5');

    const codex53Count = values.filter((s) => s.model === 'gpt-5.3-codex').length;
    const othersCount = values.length - codex53Count;
    expect(codex53Count).toBeGreaterThanOrEqual(othersCount);
  });

  it('should have correct context windows per model', () => {
    for (const s of values) {
      if (s.model === 'gpt-5.3-codex' || s.model === 'gpt-5.2-codex') {
        expect(s.contextTokens).toBe(400000);
      } else if (s.model === 'MiniMax-M2.5') {
        expect(s.contextTokens).toBe(200000);
      }
    }
  });

  it('should have diverse usage distribution (not all high)', () => {
    const usages = values.map((s) => Math.round((s.totalTokens / s.contextTokens) * 100));
    const low = usages.filter((u) => u <= 15);
    const mid = usages.filter((u) => u > 15 && u <= 60);
    const high = usages.filter((u) => u > 60);
    expect(low.length).toBeGreaterThanOrEqual(2);
    expect(mid.length).toBeGreaterThanOrEqual(3);
    expect(high.length).toBeGreaterThanOrEqual(2);
  });

  it('should include multiple session types', () => {
    const keys = Object.keys(sessions);
    expect(keys.some((k) => k.includes(':cron:'))).toBe(true);
    const hasGroup = values.some((s) => s.chatType === 'group');
    expect(hasGroup).toBe(true);
    const hasDirect = values.some((s) => s.chatType === 'direct');
    expect(hasDirect).toBe(true);
  });

  it('should have realistic parent-child relationships', () => {
    const subAgents = entries.filter(([_, s]) => s.spawnedBy);
    for (const [_, sub] of subAgents) {
      expect(sessions[sub.spawnedBy!]).toBeDefined();
    }
    // Dev flow should have 3 sub-agents
    const devKey = entries.find(([_, s]) => s.label?.includes('Feature Build'))?.[0];
    expect(devKey).toBeDefined();
    const devChildren = subAgents.filter(([_, s]) => s.spawnedBy === devKey);
    expect(devChildren.length).toBe(3);
    // Research flow should have 3 sub-agents
    const researchKey = entries.find(([_, s]) => s.label?.includes('API Design'))?.[0];
    expect(researchKey).toBeDefined();
    const researchChildren = subAgents.filter(([_, s]) => s.spawnedBy === researchKey);
    expect(researchChildren.length).toBe(3);
  });
});
