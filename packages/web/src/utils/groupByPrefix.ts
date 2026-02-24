interface SessionLike {
  displayName: string;
  totalTokens: number;
  [key: string]: unknown;
}

export type GroupedItem<T extends SessionLike = SessionLike> =
  | { type: 'group'; prefix: string; items: T[]; totalTokens: number }
  | { type: 'single'; item: T };

export function groupByPrefix<T extends SessionLike>(items: T[]): GroupedItem<T>[] {
  if (items.length === 0) {return [];}

  const buckets = new Map<string, T[]>();
  const noPrefix: T[] = [];

  for (const item of items) {
    const dashIdx = item.displayName.indexOf('-');
    if (dashIdx <= 0) {
      noPrefix.push(item);
      continue;
    }
    const prefix = item.displayName.slice(0, dashIdx);
    if (!buckets.has(prefix)) {buckets.set(prefix, []);}
    buckets.get(prefix)?.push(item);
  }

  const result: GroupedItem<T>[] = [];

  for (const [prefix, group] of buckets) {
    if (group.length >= 2) {
      result.push({
        type: 'group',
        prefix,
        items: group,
        totalTokens: group.reduce((sum, s) => sum + s.totalTokens, 0),
      });
    } else {
      result.push({ type: 'single', item: group[0] });
    }
  }

  for (const item of noPrefix) {
    result.push({ type: 'single', item });
  }

  return result;
}
