import { describe, expect,it } from 'vitest';

import { getTooltips } from '../metricsTooltips';

describe('getTooltips', () => {
  const t = (key: string) => key;

  it('returns sections and summary tooltips', () => {
    const tips = getTooltips(t);
    expect(tips.sections.sessions.label).toBe('tooltip.sections.sessions');
    expect(tips.summary.peakSessions.label).toBe('tooltip.summary.peakSessions');
    expect(tips.chartFooter.sessions).toContain('active sessions');
  });

  it('passes translation keys through t()', () => {
    const mockT = (key: string) => `translated:${key}`;
    const tips = getTooltips(mockT);
    expect(tips.sections.errors.label).toBe('translated:tooltip.sections.errors');
    expect(tips.summary.uptime.detail).toBe('translated:tooltip.detail.summary.uptime');
  });
});
