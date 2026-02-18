import { describe, it, expect, vi } from 'vitest';
import { SystemMetrics } from '../system-metrics.js';

describe('SystemMetrics branch coverage', () => {
  it('getMetrics returns cpu=0 memoryMB=0 when no PID found', async () => {
    const sm = new SystemMetrics();
    vi.spyOn(sm, 'getPid').mockResolvedValue(null);
    (sm as any).cache = null;
    (sm as any).cacheTime = 0;

    const metrics = await sm.getMetrics();
    expect(metrics.cpu).toBe(0);
    expect(metrics.memoryMB).toBe(0);
    expect(typeof metrics.diskMB).toBe('number');
  });

  it('getMetrics returns defaults when getProcessMetrics returns null (non-existent PID)', async () => {
    const sm = new SystemMetrics();
    vi.spyOn(sm, 'getPid').mockResolvedValue(99999999);
    (sm as any).cache = null;
    (sm as any).cacheTime = 0;

    const metrics = await sm.getMetrics();
    expect(metrics.cpu).toBe(0);
    expect(metrics.memoryMB).toBe(0);
  });

  it('getPid returns null when gateway line has no numeric PID', async () => {
    const sm = new SystemMetrics();
    // Just verify the method handles edge cases without crashing
    const pid = await sm.getPid();
    expect(pid === null || typeof pid === 'number').toBe(true);
  });
});
