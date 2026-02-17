import { describe, it, expect } from 'vitest';
import { mapEvent, EVENT_MAP } from '../events-mapper.js';

describe('events-mapper', () => {
  it('should map error to severity.error + openclaw', () => {
    const result = mapEvent('error');
    expect(result.category).toBe('severity.error');
    expect(result.source).toBe('openclaw');
  });

  it('should map warning to severity.warning + openclaw', () => {
    const result = mapEvent('warning');
    expect(result.category).toBe('severity.warning');
    expect(result.source).toBe('openclaw');
  });

  it('should map gateway_restart to lifecycle.restart + openclaw.gateway', () => {
    const result = mapEvent('gateway_restart');
    expect(result.category).toBe('lifecycle.restart');
    expect(result.source).toBe('openclaw.gateway');
  });

  it('should map gateway_start to lifecycle.start', () => {
    const result = mapEvent('gateway_start');
    expect(result.category).toBe('lifecycle.start');
    expect(result.source).toBe('openclaw.gateway');
  });

  it('should map gateway_stop to lifecycle.stop', () => {
    const result = mapEvent('gateway_stop');
    expect(result.category).toBe('lifecycle.stop');
    expect(result.source).toBe('openclaw.gateway');
  });

  it('should map spawn_agent to activity.spawn', () => {
    const result = mapEvent('spawn_agent');
    expect(result.category).toBe('activity.spawn');
    expect(result.source).toBe('openclaw.agent');
  });

  it('should map tool_call to activity.tool_call', () => {
    const result = mapEvent('tool_call');
    expect(result.category).toBe('activity.tool_call');
    expect(result.source).toBe('openclaw');
  });

  it('should map api_call to activity.api_call', () => {
    const result = mapEvent('api_call');
    expect(result.category).toBe('activity.api_call');
    expect(result.source).toBe('openclaw');
  });

  it('should map validation_warning to severity.validation_warning', () => {
    const result = mapEvent('validation_warning');
    expect(result.category).toBe('severity.validation_warning');
    expect(result.source).toBe('claw-insights');
  });

  it('should fallback unknown types to uncategorized + unknown', () => {
    const result = mapEvent('something_new');
    expect(result.category).toBe('uncategorized');
    expect(result.source).toBe('unknown');
  });

  it('should export EVENT_MAP with all known types', () => {
    expect(Object.keys(EVENT_MAP).length).toBeGreaterThanOrEqual(9);
  });
});
