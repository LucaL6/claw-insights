import type { PricingResolver } from 'tokentally';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('pricing-catalog');

let catalogCache: { resolver: PricingResolver; ts: number } | null = null;
const CATALOG_TTL = 30 * 60 * 1000; // 30 min

export async function getCatalogResolver(): Promise<PricingResolver | null> {
  if (catalogCache && Date.now() - catalogCache.ts < CATALOG_TTL) {
    return catalogCache.resolver;
  }
  try {
    const { loadLiteLlmCatalog, resolveLiteLlmPricing } = await import('tokentally/node');
    const { catalog } = await loadLiteLlmCatalog({ env: process.env, fetchImpl: fetch });
    if (!catalog) return null;
    const resolver: PricingResolver = (model: string) => resolveLiteLlmPricing(catalog, model);
    catalogCache = { resolver, ts: Date.now() };
    return resolver;
  } catch (err) {
    log.warn({ err: err as Error }, 'failed to load LiteLLM catalog');
    return null;
  }
}

export function resetCatalogCache(): void {
  catalogCache = null;
}
