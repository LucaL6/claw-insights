import { describe, expect, it } from 'vitest';

interface Span {
  start: number;
  end: number;
}

function hasOverlap(spans: Span[]): boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start < sorted[i - 1]!.end) {
      return true;
    }
  }
  return false;
}

async function runConcurrentOpsAndCollectSpans(): Promise<Span[]> {
  const { LogControlMutex } = await import('../log-control-mutex.js');
  const mutex = new LogControlMutex();

  const spans: Span[] = [];

  const run = async (op: 'rotate' | 'reclaim' | 'sweep', holdMs: number) => {
    await mutex.runExclusive(op, async () => {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, holdMs));
      spans.push({ start, end: Date.now() });
    });
  };

  await Promise.all([run('rotate', 20), run('reclaim', 15), run('sweep', 10)]);
  return spans;
}

describe('log control mutex', () => {
  it('serializes rotate/reclaim/sweep without overlapping critical sections', async () => {
    const spans = await runConcurrentOpsAndCollectSpans();
    expect(hasOverlap(spans)).toBe(false);
  });
});
