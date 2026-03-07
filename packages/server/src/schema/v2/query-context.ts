interface FilterDefaults {
  readonly timeRange?: {
    readonly from?: number | null;
    readonly to?: number | null;
    readonly preset?: string | null;
  } | null;
  readonly tags?: readonly string[] | null;
}

export interface QueryContextData {
  readonly trace?: {
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  };
  readonly preferences?: {
    readonly locale?: string | null;
    readonly timezone?: string | null;
  };
  readonly defaults?: FilterDefaults;
  readonly extensions?: unknown;
}

/**
 * Extract typed query context from raw resolver input.
 *
 * Phase 3 scaffolding: currently exported for upcoming selector/context-input wiring.
 */
export const extractQueryContext = (raw: Record<string, unknown> | null | undefined): QueryContextData => {
  if (!raw) {return {};}

  const result: Record<string, unknown> = {};

  if (raw.trace) {result.trace = raw.trace;}
  if (raw.preferences) {result.preferences = raw.preferences;}
  if (raw.defaults) {result.defaults = raw.defaults;}
  if (raw.extensions !== undefined) {result.extensions = raw.extensions;}

  return result as QueryContextData;
};
