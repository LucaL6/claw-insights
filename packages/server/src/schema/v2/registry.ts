import { createChildLogger } from '../../logger.js';
import { type FilterInput, matchFilter, resolveSelector, type SelectorInput, type SourceEntry } from './selector.js';

const log = createChildLogger('source-registry');

export interface SourceAdapter {
  readonly info: SourceEntry;
  readonly resolvers: Readonly<Record<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>>;
}

export interface SourceRegistry {
  register(adapter: SourceAdapter): void;
  resolve(selector: SelectorInput): SourceAdapter | null;
  list(filter?: FilterInput | null): SourceEntry[];
  getDefaultSource(category: string): SourceAdapter | null;
}

export const createSourceRegistry = (): SourceRegistry => {
  const adapters = new Map<string, SourceAdapter>();

  const register = (adapter: SourceAdapter): void => {
    adapters.set(adapter.info.id, adapter);
    log.info({ id: adapter.info.id, category: adapter.info.attributes.category }, 'source registered');
  };

  /**
   * Resolve a single source by selector.
   * Phase 3 scaffolding: called once selector routing is enabled in Query.context.
   */
  const resolve = (selector: SelectorInput): SourceAdapter | null => {
    const entries = [...adapters.values()].map((a) => a.info);
    const found = resolveSelector(entries, selector, (msg) => log.warn(msg));
    if (!found) {return null;}
    return adapters.get(found.id) ?? null;
  };

  const list = (filter?: FilterInput | null): SourceEntry[] => {
    const entries = [...adapters.values()].map((a) => a.info);
    return matchFilter(entries, filter);
  };

  const getDefaultSource = (category: string): SourceAdapter | null => {
    const matching = [...adapters.values()].filter((a) => a.info.attributes.category === category);
    return matching.length === 1 ? matching[0] : null;
  };

  return { register, resolve, list, getDefaultSource };
};
