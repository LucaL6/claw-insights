/** Centralized tooltip text for all metrics — i18n aware */

type T = (key: string) => string;

export function getTooltips(t: T) {
  return {
    // ── Section-level (title ⓘ) ──
    sections: {
      sessions: {
        label: t('tooltip.sections.sessions'),
        detail: t('tooltip.detail.sections.sessions'),
      },
      tokens: {
        label: t('tooltip.sections.tokens'),
        detail: t('tooltip.detail.sections.tokens'),
      },
      errors: {
        label: t('tooltip.sections.errors'),
        detail: t('tooltip.detail.sections.errors'),
      },
      uptime: {
        label: t('tooltip.sections.uptime'),
        detail: t('tooltip.detail.sections.uptime'),
      },
    },

    // ── Summary values (right-corner ⓘ) ──
    summary: {
      peakSessions: {
        label: t('tooltip.summary.peakSessions'),
        detail: t('tooltip.detail.summary.peakSessions'),
      },
      rangeTokens: {
        label: t('tooltip.summary.rangeTokens'),
        detail: t('tooltip.detail.summary.rangeTokens'),
      },
      totalErrors: {
        label: t('tooltip.summary.totalErrors'),
        detail: t('tooltip.detail.summary.totalErrors'),
      },
      uptime: {
        label: t('tooltip.summary.uptime'),
        detail: t('tooltip.detail.summary.uptime'),
      },
      summaryTokens: {
        label: t('tooltip.summary.summaryTokens'),
        detail: t('tooltip.detail.summary.summaryTokens'),
      },
      summaryErrors: {
        label: t('tooltip.summary.summaryErrors'),
        detail: t('tooltip.detail.summary.summaryErrors'),
      },
      summaryWarnings: {
        label: t('tooltip.summary.summaryWarnings'),
        detail: t('tooltip.detail.summary.summaryWarnings'),
      },
    },

    // ── Chart data point (ECharts tooltip footer) ──
    chartFooter: {
      sessions: 'active sessions · MAX(active_sessions)',
      tokens: 'token consumption · SUM(token_delta_k)',
      errors: 'event count · COUNT(*)',
    },
  } as const;
}
