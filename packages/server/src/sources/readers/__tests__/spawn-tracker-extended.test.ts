import { describe, expect,it } from 'vitest';

import { SpawnTracker } from '../spawn-tracker';

describe('SpawnTracker extended', () => {
  it('ignores entries without runId', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'no run id here' });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('ignores entries with runId but no session match', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'runId=abc123 some random message' });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('only creates mapping when both parent and child are known', () => {
    const t = new SpawnTracker();
    // Only parent, no child yet
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'sessions_spawn runId=abc session=parent1' });
    expect(t.getParentChildMap().size).toBe(0);
  });

  it('links parent and child regardless of order', () => {
    const t = new SpawnTracker();
    // Child first
    t.ingest({ time: '10:01', level: 'INFO', module: 'x', message: 'spawned session runId=r1 sessionKey=child1' });
    // Then parent
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'sessions_spawn runId=r1 session=parent1' });
    expect(t.getParentChildMap().get('parent1')).toEqual(['child1']);
  });

  it('handles childSession keyword', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '10:00', level: 'INFO', module: 'x', message: 'sessions_spawn runId=r2 session=p2' });
    t.ingest({ time: '10:01', level: 'INFO', module: 'x', message: 'childSession created runId=r2 sessionKey=c2' });
    expect(t.getParentChildMap().get('p2')).toEqual(['c2']);
  });

  it('maps multiple children to same parent', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '1', level: 'INFO', module: 'x', message: 'sessions_spawn runId=r1 session=p' });
    t.ingest({ time: '2', level: 'INFO', module: 'x', message: 'spawned session runId=r1 sessionKey=c1' });
    t.ingest({ time: '3', level: 'INFO', module: 'x', message: 'sessions_spawn runId=r2 session=p' });
    t.ingest({ time: '4', level: 'INFO', module: 'x', message: 'spawned session runId=r2 sessionKey=c2' });
    const map = t.getParentChildMap();
    expect(map.get('p')?.sort()).toEqual(['c1', 'c2']);
  });

  it('prune does nothing when under limit', () => {
    const t = new SpawnTracker();
    t.ingest({ time: '1', level: 'INFO', module: 'x', message: 'sessions_spawn runId=r1 session=p1' });
    t.ingest({ time: '2', level: 'INFO', module: 'x', message: 'spawned session runId=r1 sessionKey=c1' });
    t.prune(500);
    expect(t.getParentChildMap().get('p1')).toEqual(['c1']);
  });

  it('prune removes oldest entries and rebuilds map', () => {
    const t = new SpawnTracker();
    // Add more than maxEntries
    for (let i = 0; i < 10; i++) {
      t.ingest({ time: `${i}`, level: 'INFO', module: 'x', message: `sessions_spawn runId=r${i} session=p${i}` });
      t.ingest({ time: `${i}`, level: 'INFO', module: 'x', message: `spawned session runId=r${i} sessionKey=c${i}` });
    }
    expect(t.getParentChildMap().size).toBe(10);
    t.prune(5);
    // Should keep only last 5
    expect(t.getParentChildMap().size).toBe(5);
    expect(t.getParentChildMap().has('p0')).toBe(false);
    expect(t.getParentChildMap().has('p9')).toBe(true);
  });

  it('prune rebuilds correctly when some entries lack children', () => {
    const t = new SpawnTracker();
    for (let i = 0; i < 10; i++) {
      t.ingest({ time: `${i}`, level: 'INFO', module: 'x', message: `sessions_spawn runId=r${i} session=p${i}` });
      // Only odd entries get children
      if (i % 2 === 1) {
        t.ingest({ time: `${i}`, level: 'INFO', module: 'x', message: `spawned session runId=r${i} sessionKey=c${i}` });
      }
    }
    t.prune(5);
    // After prune, only entries r5-r9 remain, of which r5,r7,r9 have children
    const map = t.getParentChildMap();
    expect(map.has('p7')).toBe(true);
    expect(map.has('p6')).toBe(false); // p6 has no child
  });
});
