/** Centralized tooltip text for all metrics */

export const TOOLTIPS = {
  // ── Section-level (title ⓘ) ──
  sections: {
    sessions: {
      label: '各时段的峰值并发会话数',
      detail: 'MAX(active_sessions) per bucket, sampled every 30s',
    },
    tokens: {
      label: '各时段的 token 消耗增量',
      detail: 'MAX(total_tokens_k) - MIN(total_tokens_k) per bucket',
    },
    errors: {
      label: '各时段的错误与警告数量',
      detail: 'COUNT(error|warning) from metric_events',
    },
    uptime: {
      label: '网关在线状态时间线',
      detail: 'Per-bucket gateway health check',
    },
  },

  // ── Summary values (right-corner ⓘ) ──
  summary: {
    peakSessions: {
      label: '该范围内的峰值并发数',
      detail: 'peak of MAX(active_sessions) across all buckets',
    },
    rangeTokens: {
      label: '该范围内的 token 消耗总量',
      detail: 'SUM of per-bucket MAX-MIN(total_tokens_k)',
    },
    totalErrors: {
      label: '该范围内的错误总数',
      detail: 'SUM(error events) in range',
    },
    uptime: {
      label: '网关在线百分比',
      detail: 'healthy buckets / total buckets × 100',
    },
    summaryTokens: {
      label: '该范围内的 token 消耗总量',
      detail: 'SUM of per-bucket MAX-MIN(total_tokens_k)',
    },
    summaryErrors: {
      label: '该范围内的错误数',
      detail: 'SUM(error events)',
    },
    summaryWarnings: {
      label: '该范围内的警告数',
      detail: 'SUM(warning events)',
    },
  },

  // ── Chart data point (ECharts tooltip footer) ──
  chartFooter: {
    sessions: 'peak concurrent sessions · MAX(active_sessions)',
    tokens: 'token delta in this period · MAX-MIN(total_tokens_k)',
    errors: 'event count in this period · COUNT(type)',
  },
} as const;
