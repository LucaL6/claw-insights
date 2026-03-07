import { describe, expect, it } from 'vitest';

import { createSourceRegistry, type SourceAdapter } from '../registry.js';

const makeAdapter = (id: string, category: string, provider: string, tags: string[] = []): SourceAdapter => ({
  info: { id, name: id, status: 'CONNECTED', attributes: { category, provider, tags } },
  resolvers: {},
});

describe('createSourceRegistry', () => {
  it('register and list sources', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'openclaw'));
    expect(reg.list()).toHaveLength(1);
    expect(reg.list()[0].id).toBe('agent:main');
  });

  it('resolve by id', () => {
    const reg = createSourceRegistry();
    const a = makeAdapter('agent:main', 'AGENT', 'openclaw');
    reg.register(a);
    expect(reg.resolve({ id: 'agent:main' })).toBe(a);
  });

  it('resolve returns null for unknown', () => {
    const reg = createSourceRegistry();
    expect(reg.resolve({ id: 'x' })).toBeNull();
  });

  it('list with filter', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'openclaw'));
    reg.register(makeAdapter('kanban:local', 'KANBAN', 'kanban'));
    expect(reg.list({ category: 'AGENT' })).toHaveLength(1);
  });

  it('getDefaultSource returns sole of category', () => {
    const reg = createSourceRegistry();
    const a = makeAdapter('agent:main', 'AGENT', 'openclaw');
    reg.register(a);
    expect(reg.getDefaultSource('AGENT')).toBe(a);
  });

  it('getDefaultSource returns null for multiple', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'openclaw'));
    reg.register(makeAdapter('agent:work', 'AGENT', 'openclaw'));
    expect(reg.getDefaultSource('AGENT')).toBeNull();
  });
});
