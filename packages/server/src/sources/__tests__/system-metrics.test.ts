import { describe, it, expect } from 'vitest';
import { SystemMetrics } from '../system-metrics';

describe('SystemMetrics', () => {
  const metrics = new SystemMetrics();

  it('should return metrics object', async () => {
    const data = await metrics.getMetrics();
    expect(typeof data.cpu).toBe('number');
    expect(typeof data.memoryMB).toBe('number');
    expect(typeof data.diskMB).toBe('number');
    expect(typeof data.sampledAt).toBe('string');
  });

  it('should return disk usage > 0 when .openclaw exists', async () => {
    const data = await metrics.getMetrics();
    expect(data.diskMB).toBeGreaterThan(0);
  });

  it('should cache results within TTL', async () => {
    const a = await metrics.getMetrics();
    const b = await metrics.getMetrics();
    expect(a.sampledAt).toBe(b.sampledAt); // Same cached value
  });

  it('should detect gateway PID', async () => {
    const pid = await metrics.getPid();
    // May be null if gateway isn't running, but should not throw
    expect(pid === null || typeof pid === 'number').toBe(true);
  });
});
