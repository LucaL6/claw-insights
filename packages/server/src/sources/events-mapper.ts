export interface EventMapping {
  category: string;
  source: string;
}

export const EVENT_MAP: Record<string, EventMapping> = {
  error:               { category: 'severity.error',              source: 'openclaw' },
  warning:             { category: 'severity.warning',            source: 'openclaw' },
  gateway_start:       { category: 'lifecycle.start',             source: 'openclaw.gateway' },
  gateway_stop:        { category: 'lifecycle.stop',              source: 'openclaw.gateway' },
  gateway_restart:     { category: 'lifecycle.restart',           source: 'openclaw.gateway' },
  spawn_agent:         { category: 'activity.spawn',              source: 'openclaw.agent' },
  tool_call:           { category: 'activity.tool_call',          source: 'openclaw' },
  api_call:            { category: 'activity.api_call',           source: 'openclaw' },
  validation_warning:  { category: 'severity.validation_warning', source: 'claw-insights' },
};

const FALLBACK: EventMapping = { category: 'uncategorized', source: 'unknown' };

export function mapEvent(type: string): EventMapping {
  return EVENT_MAP[type] ?? FALLBACK;
}
