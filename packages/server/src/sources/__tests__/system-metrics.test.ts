import { describe, it, expect } from 'bun:test';
import { SystemMetrics } from '../system-metrics';

describe('SystemMetrics', () => {
  const metrics = new SystemMetrics();

  it('should return metrics object', () => {
    const data = metrics.getMetrics();
    expect(typeof data.cpu).toBe('number');
    expect(typeof data.memoryMB).toBe('number');
    expect(typeof data.diskMB).toBe('number');
    expect(typeof data.sampledAt).toBe('string');
  });

  it('should return disk usage > 0 when .openclaw exists', () => {
    const data = metrics.getMetrics();
    expect(data.diskMB).toBeGreaterThan(0);
  });

  it('should cache results within TTL', () => {
    const a = metrics.getMetrics();
    const b = metrics.getMetrics();
    expect(a.sampledAt).toBe(b.sampledAt); // Same cached value
  });

  it('should detect gateway PID', () => {
    const pid = metrics.getPid();
    // May be null if gateway isn't running, but should not throw
    expect(pid === null || typeof pid === 'number').toBe(true);
  });
});
