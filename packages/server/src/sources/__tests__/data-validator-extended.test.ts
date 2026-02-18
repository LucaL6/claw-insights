import { describe, it, expect, vi, afterEach } from 'vitest';
import { DataValidator } from '../data-validator';

vi.mock('../../db/event-queries.js', () => ({
  insertEvent: vi.fn(),
}));

describe('DataValidator instance methods', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('runValidation returns results and inserts event on failure', async () => {
    const { insertEvent } = await import('../../db/event-queries');
    const db = {} as any;
    const v = new DataValidator(db, () => 100, () => 200);
    const results = v.runValidation();
    expect(results).toHaveLength(1);
    expect(results[0].pass).toBe(false);
    expect(results[0].metric).toBe('daily_tokens_k');
    expect(insertEvent).toHaveBeenCalledWith(db, 'validation_warning', expect.any(Number), expect.any(Object));
  });

  it('runValidation does not insert event when passing', async () => {
    const { insertEvent } = await import('../../db/event-queries');
    const db = {} as any;
    const v = new DataValidator(db, () => 100, () => 100);
    const results = v.runValidation();
    expect(results[0].pass).toBe(true);
    expect(insertEvent).not.toHaveBeenCalled();
  });

  it('start creates interval and stop clears it', () => {
    vi.useFakeTimers();
    const db = {} as any;
    const v = new DataValidator(db, () => 0, () => 0);
    v.start(1000);
    vi.advanceTimersByTime(3000);
    v.stop();
    // Just verify no crash
  });

  it('stop does nothing if not started', () => {
    const db = {} as any;
    const v = new DataValidator(db, () => 0, () => 0);
    // Should not throw
    v.stop();
  });

  it('compare with negative values', () => {
    const r = DataValidator.compare(-10, -12, 'test');
    expect(r.deviation).toBeCloseTo(2 / 12, 4);
  });

  it('compare message contains percentage', () => {
    const r = DataValidator.compare(100, 150, 'test');
    expect(r.message).toContain('EXCEEDS');
    expect(r.message).toContain('%');
  });

  it('compare within threshold message', () => {
    const r = DataValidator.compare(100, 110, 'test');
    expect(r.message).toContain('Within threshold');
  });
});
