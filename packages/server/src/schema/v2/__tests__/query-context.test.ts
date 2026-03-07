import { describe, expect, it } from 'vitest';

import { extractQueryContext } from '../query-context.js';

describe('extractQueryContext', () => {
  it('extracts trace info', () => {
    const ctx = extractQueryContext({ trace: { requestId: 'abc', traceId: 'xyz' } });
    expect(ctx.trace).toEqual({ requestId: 'abc', traceId: 'xyz' });
  });

  it('extracts preferences', () => {
    const ctx = extractQueryContext({ preferences: { locale: 'zh-CN', timezone: 'Asia/Shanghai' } });
    expect(ctx.preferences).toEqual({ locale: 'zh-CN', timezone: 'Asia/Shanghai' });
  });

  it('extracts defaults', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { preset: 'ONE_HOUR' }, tags: ['prod'] } });
    expect(ctx.defaults?.timeRange?.preset).toBe('ONE_HOUR');
    expect(ctx.defaults?.tags).toEqual(['prod']);
  });

  it('handles null/undefined', () => {
    expect(extractQueryContext(null)).toEqual({});
    expect(extractQueryContext(undefined)).toEqual({});
  });

  it('preserves extensions as-is (any JSON value)', () => {
    const ctx = extractQueryContext({ extensions: { custom: { nested: true } } });
    expect(ctx.extensions).toEqual({ custom: { nested: true } });
  });

  it('extensions can be non-object JSON value', () => {
    const ctx = extractQueryContext({ extensions: [1, 2, 3] });
    expect(ctx.extensions).toEqual([1, 2, 3]);
  });
});
