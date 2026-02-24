import { describe, expect,it } from 'vitest';

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
});
