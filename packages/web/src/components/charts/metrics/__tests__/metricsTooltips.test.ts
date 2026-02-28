import { describe, expect, it } from 'vitest';

import { getTooltips } from '../metricsTooltips';

describe('getTooltips', () => {
  const t = (key: string) => key;

  it('returns sections and summary tooltips', () => {
    const tips = getTooltips(t);
    expect(tips.sections.sessions.label).toBe('tooltip.sections.sessions');
    expect(tips.summary.peakSessions.label).toBe('tooltip.summary.peakSessions');
    expect(tips.chartFooter.sessions()).toBe('tooltip.footer.sessions');
  });

  it('passes translation keys through t()', () => {
    const mockT = (key: string) => `translated:${key}`;
    const tips = getTooltips(mockT);
    expect(tips.sections.errors.label).toBe('translated:tooltip.sections.errors');
    expect(tips.summary.uptime.detail).toBe('translated:tooltip.detail.summary.uptime');
  });

  it('chartFooter.tokens reflects model filter', () => {
    const tips = getTooltips(t);
    expect(tips.chartFooter.tokens()).toBe('tooltip.footer.tokens');
    expect(tips.chartFooter.tokens('Opus 4.6')).toBe('tooltip.footer.tokensFiltered');
    // With real translations, the model name gets interpolated
    const realT = (key: string) => (key === 'tooltip.footer.tokensFiltered' ? 'token consumption · {model} only' : key);
    const realTips = getTooltips(realT);
    expect(realTips.chartFooter.tokens('Opus 4.6')).toContain('Opus 4.6');
  });

  it('chartFooter.conversations reflects role filter', () => {
    const tips = getTooltips(t);
    expect(tips.chartFooter.conversations()).toBe('tooltip.footer.conversations');
    expect(tips.chartFooter.conversations('user')).toBe('tooltip.footer.convUser');
    expect(tips.chartFooter.conversations('assistant')).toBe('tooltip.footer.convAssistant');
  });
});
