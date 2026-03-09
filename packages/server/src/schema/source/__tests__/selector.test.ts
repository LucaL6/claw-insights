import { describe, expect, it } from 'vitest';

import { matchFilter, resolveSelector, type SourceEntry } from '../selector.js';

const agentMain: SourceEntry = {
  id: 'agent:main',
  name: 'Main Agent',
  status: 'CONNECTED',
  attributes: { category: 'AGENT', provider: 'OPENCLAW', tags: ['production'] },
};

const agentWork: SourceEntry = {
  id: 'agent:work',
  name: 'Work Agent',
  status: 'CONNECTED',
  attributes: { category: 'AGENT', provider: 'OPENCLAW', tags: ['work'] },
};

const dashboard: SourceEntry = {
  id: 'dashboard:main',
  name: 'Dashboard',
  status: 'CONNECTED',
  attributes: { category: 'DASHBOARD', provider: 'OPENCLAW', tags: [] },
};

const sources = [agentMain, agentWork, dashboard];

describe('resolveSelector', () => {
  it('resolves by exact id', () => {
    expect(resolveSelector(sources, { id: 'agent:main' })).toEqual(agentMain);
  });

  it('returns null for unknown id', () => {
    expect(resolveSelector(sources, { id: 'unknown' })).toBeNull();
  });

  it('ignores other fields when id is present and logs warning', () => {
    const warnings: string[] = [];
    const result = resolveSelector(sources, { id: 'agent:main', category: 'DASHBOARD' }, (msg) => warnings.push(msg));
    expect(result).toEqual(agentMain);
    expect(warnings).toHaveLength(1);
  });

  it('resolves by category when unique match', () => {
    expect(resolveSelector(sources, { category: 'DASHBOARD' })).toEqual(dashboard);
  });

  it('throws AMBIGUOUS_SELECTOR when multiple match', () => {
    expect(() => resolveSelector(sources, { category: 'AGENT' })).toThrow('AMBIGUOUS_SELECTOR');
  });

  it('returns null when no match', () => {
    expect(resolveSelector(sources, { provider: 'CLAUDE_CODE' })).toBeNull();
  });

  it('tags matching is AND (all must be present)', () => {
    expect(resolveSelector(sources, { category: 'AGENT', tags: ['production'] })).toEqual(agentMain);
  });

  it('tags AND: fails when not all tags present', () => {
    expect(resolveSelector(sources, { category: 'AGENT', tags: ['production', 'nonexistent'] })).toBeNull();
  });

  it('string matching is case-sensitive', () => {
    expect(resolveSelector(sources, { category: 'AGENT', provider: 'CLAUDE_CODE' })).toBeNull();
  });
});

describe('matchFilter', () => {
  it('returns all when no filter', () => {
    expect(matchFilter(sources)).toEqual(sources);
  });

  it('filters by category', () => {
    expect(matchFilter(sources, { category: 'AGENT' })).toEqual([agentMain, agentWork]);
  });

  it('filters by tags (AND)', () => {
    expect(matchFilter(sources, { tags: ['production'] })).toEqual([agentMain]);
  });

  it('filters by status', () => {
    expect(matchFilter(sources, { status: 'DISCONNECTED' })).toEqual([]);
  });
});
