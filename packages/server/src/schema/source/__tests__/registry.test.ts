import { describe, expect, it } from 'vitest';

import { createSourceRegistry, type SourceAdapter } from '../registry.js';
import type { SourceCategory, SourceProvider } from '../selector.js';

const makeAdapter = (
  id: string,
  category: SourceCategory,
  provider: SourceProvider,
  tags: string[] = [],
): SourceAdapter => ({
  info: { id, name: id, status: 'CONNECTED', attributes: { category, provider, tags } },
  resolvers: {},
});

describe('createSourceRegistry', () => {
  it('register and list sources', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'OPENCLAW'));
    expect(reg.list()).toHaveLength(1);
    expect(reg.list()[0].id).toBe('agent:main');
  });

  it('resolve by id', () => {
    const reg = createSourceRegistry();
    const a = makeAdapter('agent:main', 'AGENT', 'OPENCLAW');
    reg.register(a);
    expect(reg.resolve({ id: 'agent:main' })).toBe(a);
  });

  it('resolve returns null for unknown', () => {
    const reg = createSourceRegistry();
    expect(reg.resolve({ id: 'x' })).toBeNull();
  });

  it('list with filter', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'OPENCLAW'));
    reg.register(makeAdapter('dashboard:main', 'DASHBOARD', 'OPENCLAW'));
    expect(reg.list({ category: 'AGENT' })).toHaveLength(1);
  });

  it('getDefaultSource returns sole of category', () => {
    const reg = createSourceRegistry();
    const a = makeAdapter('agent:main', 'AGENT', 'OPENCLAW');
    reg.register(a);
    expect(reg.getDefaultSource('AGENT')).toBe(a);
  });

  it('getDefaultSource returns null for multiple', () => {
    const reg = createSourceRegistry();
    reg.register(makeAdapter('agent:main', 'AGENT', 'OPENCLAW'));
    reg.register(makeAdapter('agent:work', 'AGENT', 'OPENCLAW'));
    expect(reg.getDefaultSource('AGENT')).toBeNull();
  });
});
