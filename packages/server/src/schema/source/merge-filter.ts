export interface FilterDefaults {
  readonly timeRange?: {
    readonly from?: number | null;
    readonly to?: number | null;
    readonly preset?: string | null;
  } | null;
  readonly tags?: readonly string[] | null;
}

interface TimeRangeArgs {
  from?: number | null;
  to?: number | null;
}

interface MetricsArgs {
  range?: string | null;
  date?: string | null;
}

/**
 * Merge time range: field args > defaults > empty.
 * Used by events, eventCounts.
 */
export const mergeTimeRange = (args: TimeRangeArgs, defaults?: FilterDefaults | null): TimeRangeArgs => {
  const d = defaults?.timeRange;
  if (!d) {
    return stripNulls(args);
  }
  return stripNulls({
    from: args.from ?? d.from,
    to: args.to ?? d.to,
  });
};

/**
 * Merge metrics args: field args > defaults.preset > empty.
 * NOTE: defaults.timeRange.from/to do NOT map to metrics.date (semantic mismatch).
 */
export const mergeMetricsArgs = (args: MetricsArgs, defaults?: FilterDefaults | null): MetricsArgs => {
  const d = defaults?.timeRange;
  const result: MetricsArgs = {};
  if (args.date != null) {
    result.date = args.date;
  }
  if (args.range != null) {
    result.range = args.range;
  } else if (d?.preset != null) {
    result.range = d.preset;
  }
  return result;
};

const stripNulls = (obj: { from?: number | null; to?: number | null }): TimeRangeArgs => ({
  ...(obj.from != null ? { from: obj.from } : {}),
  ...(obj.to != null ? { to: obj.to } : {}),
});
