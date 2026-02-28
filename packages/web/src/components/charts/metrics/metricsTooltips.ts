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
      conversations: {
        label: t('tooltip.sections.conversations'),
        detail: t('tooltip.detail.sections.conversations'),
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
      sessions: () => t('tooltip.footer.sessions'),
      tokens: (model?: string | null) =>
        model ? t('tooltip.footer.tokensFiltered').replaceAll('{model}', model) : t('tooltip.footer.tokens'),
      conversations: (role?: string) => {
        if (role === 'user') {
          return t('tooltip.footer.convUser');
        }
        if (role === 'assistant') {
          return t('tooltip.footer.convAssistant');
        }
        return t('tooltip.footer.conversations');
      },
      errors: () => t('tooltip.footer.errors'),
    },
  } as const;
}
