import { describe, expect, it } from 'vitest';

import { useMetricsValidation } from '../useMetricsValidation';

describe('useMetricsValidation', () => {
  it('returns empty array for empty data', () => {
    expect(useMetricsValidation([])).toEqual([]);
  });

  it('returns empty array when data has non-zero sessions', () => {
    const data = [
      { bucket: 1, sessions: 5, tokensK: 0 },
      { bucket: 2, sessions: 3, tokensK: 0 },
    ];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('returns empty array when data has non-zero tokensK', () => {
    const data = [{ bucket: 1, sessions: 0, tokensK: 10 }];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('returns empty array when data has mixed values', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 1, tokensK: 5 },
    ];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('shows info message when all zeros with uptime > 0', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 0, tokensK: 0 },
    ];
    const messages = useMetricsValidation(data, 100);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ text: 'No activity in this time window', level: 'info' });
  });

  it('shows warn message when all zeros with uptime = 0', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 0, tokensK: 0 },
    ];
    const messages = useMetricsValidation(data, 0);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ text: 'Gateway was offline — no data collected', level: 'warn' });
  });

  it('shows info message when uptime is undefined', () => {
    const data = [{ bucket: 1, sessions: 0, tokensK: 0 }];
    const messages = useMetricsValidation(data);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ text: 'No activity in this time window', level: 'info' });
  });

  it('shows info message for partial uptime with no activity', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 0, tokensK: 0 },
    ];
    const messages = useMetricsValidation(data, 50);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ text: 'No activity in this time window', level: 'info' });
  });
});
