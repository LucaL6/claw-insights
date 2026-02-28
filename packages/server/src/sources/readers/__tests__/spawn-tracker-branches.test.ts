import { describe, expect, it } from 'vitest';

import { SpawnTracker } from '../spawn-tracker';

describe('SpawnTracker branches', () => {
  it('ignores entries without runId', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'no run id here' });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('does not map when only parent is set (no child yet)', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=abc session=parent1',
    });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('does not map when only child is set (no parent yet)', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'sessions',
      message: 'spawned session runId=abc sessionKey=child1',
    });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('prune does nothing when under maxEntries', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=abc session=parent1',
    });
    t.prune(500);
    // Should still have the entry
    t.ingest({
      time: '10:01',
      level: 'INFO',
      module: 'sessions',
      message: 'spawned session runId=abc sessionKey=child1',
    });
    expect(t.getParentChildMap().size).toBe(1);
  });

  it('prune removes old entries when over maxEntries', () => {
    const t = new SpawnTracker();
    // Add many entries
    for (let i = 0; i < 10; i++) {
      t.ingest({
        time: '10:00',
        level: 'INFO',
        module: 'tools',
        message: `tool=sessions_spawn runId=run${i} session=parent${i}`,
      });
      t.ingest({
        time: '10:01',
        level: 'INFO',
        module: 'sessions',
        message: `spawned session runId=run${i} sessionKey=child${i}`,
      });
    }
    expect(t.getParentChildMap().size).toBe(10);

    t.prune(3);
    // Should only keep last 3 entries
    const map = t.getParentChildMap();
    expect(map.size).toBeLessThanOrEqual(3);
  });

  it('prune rebuilds parentToChildren correctly for entries without child', () => {
    const t = new SpawnTracker();
    // Parent only (no child)
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=orphan session=parentOrphan',
    });
    // Full pair
    for (let i = 0; i < 5; i++) {
      t.ingest({
        time: '10:00',
        level: 'INFO',
        module: 'tools',
        message: `tool=sessions_spawn runId=run${i} session=p${i}`,
      });
      t.ingest({
        time: '10:01',
        level: 'INFO',
        module: 'sessions',
        message: `spawned session runId=run${i} sessionKey=c${i}`,
      });
    }
    t.prune(2);
    const map = t.getParentChildMap();
    expect(map.size).toBeLessThanOrEqual(2);
  });

  it('handles childSession keyword', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=xyz session=parent',
    });
    t.ingest({
      time: '10:01',
      level: 'INFO',
      module: 'sessions',
      message: 'childSession created runId=xyz sessionKey=child',
    });
    const map = t.getParentChildMap();
    expect(map.get('parent')).toEqual(['child']);
  });
});
