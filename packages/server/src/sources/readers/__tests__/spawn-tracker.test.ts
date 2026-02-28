import { describe, expect, it } from 'vitest';

import { SpawnTracker } from '../spawn-tracker';

describe('SpawnTracker', () => {
  it('should map parent to child via runId', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=abc123 session=agent:main:parent',
    });
    t.ingest({
      time: '10:01',
      level: 'INFO',
      module: 'sessions',
      message: 'spawned session runId=abc123 sessionKey=agent:main:child',
    });

    const map = t.getParentChildMap();
    expect(map.get('agent:main:parent')?.[0]).toBe('agent:main:child');
  });

  it('prune removes oldest entries when over maxEntries', () => {
    const t = new SpawnTracker();
    // Add 3 pairs
    for (let i = 0; i < 3; i++) {
      t.ingest({
        time: `10:0${i}`,
        level: 'INFO',
        module: 'tools',
        message: `tool=sessions_spawn runId=run${i} session=agent:main:p${i}`,
      });
      t.ingest({
        time: `10:0${i}`,
        level: 'INFO',
        module: 'sessions',
        message: `spawned session runId=run${i} sessionKey=agent:main:c${i}`,
      });
    }

    // Prune to keep only 1
    t.prune(1);

    const map = t.getParentChildMap();
    // Only the last entry should remain
    expect(map.size).toBeLessThanOrEqual(1);
  });

  it('prune is no-op when under maxEntries', () => {
    const t = new SpawnTracker();
    t.ingest({
      time: '10:00',
      level: 'INFO',
      module: 'tools',
      message: 'tool=sessions_spawn runId=abc session=agent:main:p1',
    });
    t.prune(500);
    const map = t.getParentChildMap();
    // Should not have removed anything
    expect(map.size).toBe(0); // p1 has no child yet
  });
});
