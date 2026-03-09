import { GraphQLError } from 'graphql';

/**
 * Runtime literal unions aligned with SDL enum-backed fields.
 * `category` / `status` are intentionally strict (no unbounded string).
 */
export type SourceCategory = 'AGENT' | 'DASHBOARD';
import { type SourceProvider } from '../generated/resolver-types.js';
export type { SourceProvider };
export type SourceStatus = 'INITIALIZING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface SourceEntry {
  readonly id: string;
  readonly name: string;
  readonly status: SourceStatus;
  readonly attributes: {
    readonly category: SourceCategory;
    readonly provider?: SourceProvider | null;
    readonly tags: readonly string[];
  };
}

export interface SelectorInput {
  readonly id?: string | null;
  readonly category?: SourceCategory | null;
  readonly provider?: SourceProvider | null;
  readonly tags?: readonly string[] | null;
}

export interface FilterInput {
  readonly category?: SourceCategory | null;
  readonly provider?: SourceProvider | null;
  readonly tags?: readonly string[] | null;
  readonly status?: SourceStatus | null;
}

type WarnFn = (msg: string) => void;
const noop: WarnFn = () => {};

export const resolveSelector = (
  sources: readonly SourceEntry[],
  selector: SelectorInput,
  warn: WarnFn = noop,
): SourceEntry | null => {
  if (selector.id != null) {
    const hasOtherFields =
      selector.category != null || selector.provider != null || (selector.tags != null && selector.tags.length > 0);
    if (hasOtherFields) {
      warn(`SourceSelector: id="${selector.id}" present, ignoring other fields`);
    }
    return sources.find((s) => s.id === selector.id) ?? null;
  }

  const matches = sources.filter((s) => matchesSelector(s, selector));

  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    return matches[0];
  }

  throw new GraphQLError(`AMBIGUOUS_SELECTOR: ${matches.length} sources match selector, refine your query`, {
    extensions: { code: 'AMBIGUOUS_SELECTOR', matchedIds: matches.map((s) => s.id) },
  });
};

export const matchFilter = (sources: readonly SourceEntry[], filter?: FilterInput | null): SourceEntry[] => {
  if (!filter) {
    return [...sources];
  }
  return sources.filter((s) => {
    if (filter.category != null && s.attributes.category !== filter.category) {
      return false;
    }
    if (filter.provider != null && s.attributes.provider !== filter.provider) {
      return false;
    }
    if (filter.status != null && s.status !== filter.status) {
      return false;
    }
    if (filter.tags != null && filter.tags.length > 0) {
      if (!filter.tags.every((t) => s.attributes.tags.includes(t))) {
        return false;
      }
    }
    return true;
  });
};

const matchesSelector = (source: SourceEntry, sel: SelectorInput): boolean => {
  if (sel.category != null && source.attributes.category !== sel.category) {
    return false;
  }
  if (sel.provider != null && source.attributes.provider !== sel.provider) {
    return false;
  }
  if (sel.tags != null && sel.tags.length > 0) {
    if (!sel.tags.every((t) => source.attributes.tags.includes(t))) {
      return false;
    }
  }
  return true;
};
