import { describe, expect, it } from 'vitest';

import { BudgetGate } from '../budget-gate.js';

const MB = 1024 * 1024;

describe('BudgetGate', () => {
  it('allows append within budget', () => {
    const gate = new BudgetGate();
    expect(gate.checkAppend('app', 1000)).toBe(true);
  });

  it('rejects when global cap would be exceeded', () => {
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('app', 1 * MB);
    expect(gate.checkAppend('app', 1)).toBe(false);
  });

  it('rejects app when soft cap exceeded', () => {
    const gate = new BudgetGate({ appSoftMb: 1, globalCapMb: 1024 });
    gate.recordAppend('app', 1 * MB);
    expect(gate.checkAppend('app', 1)).toBe(false);
  });

  it('rejects debug when soft cap exceeded', () => {
    const gate = new BudgetGate({ debugSoftMb: 1, globalCapMb: 1024 });
    gate.recordAppend('debug', 1 * MB);
    expect(gate.checkAppend('debug', 1)).toBe(false);
  });

  it('rejects noise when soft cap exceeded', () => {
    const gate = new BudgetGate({ noiseSoftMb: 1, globalCapMb: 1024 });
    gate.recordAppend('noise', 1 * MB);
    expect(gate.checkAppend('noise', 1)).toBe(false);
  });

  it('rejects access when soft cap exceeded', () => {
    const gate = new BudgetGate({ accessSoftMb: 1, globalCapMb: 1024 });
    gate.recordAppend('access', 1 * MB);
    expect(gate.checkAppend('access', 1)).toBe(false);
  });

  it('protects error floor from non-error streams', () => {
    // globalCap=10, errorFloor=8 → only 2MB available for non-error
    const gate = new BudgetGate({ globalCapMb: 10, errorFloorMb: 8, appSoftMb: 100, debugSoftMb: 100 });
    gate.recordAppend('app', 2 * MB);
    // Next app append would leave less than 8MB for error
    expect(gate.checkAppend('app', 1)).toBe(false);
  });

  it('allows error stream to use its floor', () => {
    const gate = new BudgetGate({ globalCapMb: 10, errorFloorMb: 8 });
    gate.recordAppend('app', 2 * MB);
    // Error should still be allowed
    expect(gate.checkAppend('error', 1 * MB)).toBe(true);
  });

  it('reclaims debug -> noise -> access -> app order', () => {
    const reclaimOrder: string[] = [];
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('debug', 0.4 * MB);
    gate.recordAppend('app', 0.4 * MB);
    gate.recordAppend('error', 0.2 * MB);

    gate.setReclaimFn((stream) => {
      reclaimOrder.push(stream);
      if (stream === 'access') {
        return { stream: 'access', path: 'old.log', sizeBytes: 0.4 * MB };
      }
      return null;
    });

    // This should trigger reclaim since global cap is exceeded
    gate.checkAppend('error', 0.1 * MB);
    expect(reclaimOrder.slice(0, 3)).toEqual(['debug', 'noise', 'access']);
  });

  it('retries up to 3 times for error stream', () => {
    let calls = 0;
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('app', 1 * MB);

    gate.setReclaimFn((_stream) => {
      calls++;
      // Each reclaim frees a bit
      return { stream: 'app' as const, path: 'old.log', sizeBytes: 0.1 * MB };
    });

    gate.checkAppend('error', 0.2 * MB);
    // Should have tried reclaim multiple times
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('state() reports usage correctly', () => {
    const gate = new BudgetGate({ globalCapMb: 100 });
    gate.recordAppend('app', 10 * MB);
    gate.recordAppend('error', 5 * MB);
    const s = gate.state();
    expect(s.usedByStream.app).toBe(10 * MB);
    expect(s.usedByStream.error).toBe(5 * MB);
    expect(s.totalUsed).toBe(15 * MB);
    expect(s.freeSpaceMb).toBe(85);
  });

  it('recordRemoval reduces usage', () => {
    const gate = new BudgetGate();
    gate.recordAppend('debug', 10 * MB);
    gate.recordRemoval('debug', 5 * MB);
    expect(gate.state().usedByStream.debug).toBe(5 * MB);
  });

  // P0: Critical budget reject → reclaim/retry ≤ 3 then fail-safe
  it('retries reclaim up to 3 times for error stream then signals fail-safe', () => {
    let reclaimCalls = 0;
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('app', 1 * MB);

    gate.setReclaimFn((_stream) => {
      reclaimCalls++;
      // Reclaim always fails (returns null) to force exhaustion
      return null;
    });

    const allowed = gate.checkAppend('error', 0.5 * MB);

    // Contract: must have attempted reclaim up to 3 times
    expect(reclaimCalls).toBeLessThanOrEqual(4);
    // Contract: if all reclaims fail, append must be denied
    expect(allowed).toBe(false);

    // Contract: gate must expose a fail-safe health signal
    // This will fail until BudgetGate exposes healthStatus()
    expect(typeof (gate as any).healthStatus).toBe('function');
    const health = (gate as any).healthStatus();
    expect(health.health).toBe('critical');
    expect(health.alert).toBeTruthy();
  });

  it('applies critical retry/fail-safe behavior to security stream', () => {
    let reclaimCalls = 0;
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('app', 1 * MB);

    gate.setReclaimFn((_stream) => {
      reclaimCalls++;
      return null;
    });

    const allowed = gate.checkAppend('security', 0.5 * MB);

    expect(reclaimCalls).toBeLessThanOrEqual(4);
    expect(allowed).toBe(false);

    const health = (gate as any).healthStatus();
    expect(health.health).toBe('critical');
    expect(health.alert).toContain('security');
  });

  it('sets retries-exhausted alert when reclaim succeeds but space is still insufficient', () => {
    const gate = new BudgetGate({ globalCapMb: 1 });
    gate.recordAppend('app', 1 * MB);

    // Reclaim returns a tiny amount each time — not enough to fit 0.5 MB
    gate.setReclaimFn((_stream) => 1 as unknown as import('../budget-gate.js').ReclaimCandidate); // 1 byte freed each reclaim

    const allowed = gate.checkAppend('error', 0.5 * MB);

    expect(allowed).toBe(false);
    const health = (gate as any).healthStatus();
    expect(health.health).toBe('critical');
    expect(health.alert).toContain('retries-exhausted');
  });
});
