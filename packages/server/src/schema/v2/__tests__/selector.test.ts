import { describe, expect, it } from 'vitest';

import { matchFilter, resolveSelector, type SourceEntry } from '../selector.js';

const agentMain: SourceEntry = {
  id: 'agent:main',
  name: 'Main Agent',
  status: 'CONNECTED',
  attributes: { category: 'AGENT', provider: 'openclaw', tags: ['production'] },
};

const agentWork: SourceEntry = {
  id: 'agent:work',
  name: 'Work Agent',
  status: 'CONNECTED',
  attributes: { category: 'AGENT', provider: 'openclaw', tags: ['work'] },
};

const kanban: SourceEntry = {
  id: 'kanban:local',
  name: 'Local Kanban',
  status: 'CONNECTED',
  attributes: { category: 'KANBAN', provider: 'kanban', tags: [] },
};

const sources = [agentMain, agentWork, kanban];

describe('resolveSelector', () => {
  it('resolves by exact id', () => {
    expect(resolveSelector(sources, { id: 'agent:main' })).toEqual(agentMain);
  });

  it('returns null for unknown id', () => {
    expect(resolveSelector(sources, { id: 'unknown' })).toBeNull();
  });

  it('ignores other fields when id is present and logs warning', () => {
    const warnings: string[] = [];
    const result = resolveSelector(sources, { id: 'agent:main', category: 'KANBAN' }, (msg) => warnings.push(msg));
    expect(result).toEqual(agentMain);
    expect(warnings).toHaveLength(1);
  });

  it('resolves by category when unique match', () => {
    expect(resolveSelector(sources, { category: 'KANBAN' })).toEqual(kanban);
  });

  it('throws AMBIGUOUS_SELECTOR when multiple match', () => {
    expect(() => resolveSelector(sources, { category: 'AGENT' })).toThrow('AMBIGUOUS_SELECTOR');
  });

  it('returns null when no match', () => {
    expect(resolveSelector(sources, { category: 'DASHBOARD' })).toBeNull();
  });

  it('tags matching is AND (all must be present)', () => {
    expect(resolveSelector(sources, { category: 'AGENT', tags: ['production'] })).toEqual(agentMain);
  });

  it('tags AND: fails when not all tags present', () => {
    expect(resolveSelector(sources, { category: 'AGENT', tags: ['production', 'nonexistent'] })).toBeNull();
  });

  it('string matching is case-sensitive', () => {
    expect(resolveSelector(sources, { category: 'AGENT', provider: 'OpenClaw' })).toBeNull();
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
