import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCatalogResolver, resetCatalogCache } from '../pricing-catalog.js';

// Mock the dynamic import of tokentally/node
vi.mock('tokentally/node', () => ({
  loadLiteLlmCatalog: vi.fn(),
  resolveLiteLlmPricing: vi.fn(),
}));

describe('pricing-catalog', () => {
  beforeEach(() => {
    resetCatalogCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetCatalogCache();
  });

  it('returns resolver on successful catalog load', async () => {
    const mockCatalog = { models: {} };
    const { loadLiteLlmCatalog, resolveLiteLlmPricing } = await import('tokentally/node');
    vi.mocked(loadLiteLlmCatalog).mockResolvedValue({ catalog: mockCatalog } as any);
    vi.mocked(resolveLiteLlmPricing).mockReturnValue({ input: 0.01, output: 0.03 });

    const resolver = await getCatalogResolver();
    expect(resolver).toBeTypeOf('function');
    expect(loadLiteLlmCatalog).toHaveBeenCalledOnce();

    // Call the resolver
    const pricing = resolver!('gpt-4');
    expect(resolveLiteLlmPricing).toHaveBeenCalledWith(mockCatalog, 'gpt-4');
    expect(pricing).toEqual({ input: 0.01, output: 0.03 });
  });

  it('returns cached resolver on second call within TTL', async () => {
    const mockCatalog = { models: {} };
    const { loadLiteLlmCatalog, resolveLiteLlmPricing } = await import('tokentally/node');
    vi.mocked(loadLiteLlmCatalog).mockResolvedValue({ catalog: mockCatalog } as any);
    vi.mocked(resolveLiteLlmPricing).mockReturnValue({ input: 0.01, output: 0.03 });

    const resolver1 = await getCatalogResolver();
    const resolver2 = await getCatalogResolver();

    expect(resolver1).toBe(resolver2);
    expect(loadLiteLlmCatalog).toHaveBeenCalledTimes(1); // only once — cached
  });

  it('returns null when catalog is null/undefined', async () => {
    const { loadLiteLlmCatalog } = await import('tokentally/node');
    vi.mocked(loadLiteLlmCatalog).mockResolvedValue({ catalog: null } as any);

    const resolver = await getCatalogResolver();
    expect(resolver).toBeNull();
  });

  it('returns null and logs warning on error', async () => {
    const { loadLiteLlmCatalog } = await import('tokentally/node');
    vi.mocked(loadLiteLlmCatalog).mockRejectedValue(new Error('network error'));

    const resolver = await getCatalogResolver();
    expect(resolver).toBeNull();
  });

  it('resetCatalogCache clears cache, forcing reload', async () => {
    const mockCatalog = { models: {} };
    const { loadLiteLlmCatalog, resolveLiteLlmPricing } = await import('tokentally/node');
    vi.mocked(loadLiteLlmCatalog).mockResolvedValue({ catalog: mockCatalog } as any);
    vi.mocked(resolveLiteLlmPricing).mockReturnValue({ input: 0.01, output: 0.03 });

    await getCatalogResolver();
    expect(loadLiteLlmCatalog).toHaveBeenCalledTimes(1);

    resetCatalogCache();
    await getCatalogResolver();
    expect(loadLiteLlmCatalog).toHaveBeenCalledTimes(2); // reloaded after reset
  });
});
