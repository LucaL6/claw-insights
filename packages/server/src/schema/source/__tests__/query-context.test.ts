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

  it('empty object input → empty result', () => {
    expect(extractQueryContext({})).toEqual({});
  });

  it('input with only trace → {trace}', () => {
    const ctx = extractQueryContext({ trace: { requestId: 'r1' } });
    expect(ctx).toEqual({ trace: { requestId: 'r1' } });
  });

  it('input with only preferences → {preferences}', () => {
    const ctx = extractQueryContext({ preferences: { locale: 'en' } });
    expect(ctx).toEqual({ preferences: { locale: 'en' } });
  });

  it('input with only defaults → {defaults}', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { from: 100 } } });
    expect(ctx).toEqual({ defaults: { timeRange: { from: 100 } } });
  });

  it('input with only extensions → {extensions}', () => {
    const ctx = extractQueryContext({ extensions: 'hello' });
    expect(ctx).toEqual({ extensions: 'hello' });
  });

  it('input with all four fields → full object', () => {
    const ctx = extractQueryContext({
      trace: { requestId: 'r', traceId: 't' },
      preferences: { locale: 'en', timezone: 'UTC' },
      defaults: { timeRange: { preset: 'ONE_HOUR' } },
      extensions: { x: 1 },
    });
    expect(ctx.trace).toEqual({ requestId: 'r', traceId: 't' });
    expect(ctx.preferences).toEqual({ locale: 'en', timezone: 'UTC' });
    expect(ctx.defaults).toEqual({ timeRange: { preset: 'ONE_HOUR' } });
    expect(ctx.extensions).toEqual({ x: 1 });
  });

  it('trace with invalid type (non-object) → skipped', () => {
    const ctx = extractQueryContext({ trace: 'not-an-object' } as any);
    expect(ctx.trace).toBeUndefined();
  });

  it('trace as array → skipped', () => {
    const ctx = extractQueryContext({ trace: [1, 2] } as any);
    expect(ctx.trace).toBeUndefined();
  });

  it('preferences with invalid type → skipped', () => {
    const ctx = extractQueryContext({ preferences: 42 } as any);
    expect(ctx.preferences).toBeUndefined();
  });

  it('defaults with invalid type (non-object) → skipped', () => {
    const ctx = extractQueryContext({ defaults: 'bad' } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.timeRange.from as non-number → skipped', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { from: 'bad' } } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.timeRange.to as non-number → skipped', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { to: 'bad' } } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.timeRange.preset as non-allowed string → skipped', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { preset: 'INVALID' } } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.timeRange.preset as non-string → skipped', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { preset: 123 } } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.tags filters non-string values', () => {
    const ctx = extractQueryContext({ defaults: { tags: ['ok', 42, null, 'yes'] } } as any);
    expect(ctx.defaults?.tags).toEqual(['ok', 'yes']);
  });

  it('defaults.tags all invalid → defaults undefined', () => {
    const ctx = extractQueryContext({ defaults: { tags: [1, 2, 3] } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults.tags empty array → defaults undefined', () => {
    const ctx = extractQueryContext({ defaults: { tags: [] } } as any);
    expect(ctx.defaults).toBeUndefined();
  });

  it('defaults with timeRange as non-object → only tags', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: 'bad', tags: ['a'] } } as any);
    expect(ctx.defaults).toEqual({ tags: ['a'] });
  });

  it('defaults with timeRange as array → only tags', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: [1], tags: ['b'] } } as any);
    expect(ctx.defaults).toEqual({ tags: ['b'] });
  });

  it('trace with non-string fields → empty trace object', () => {
    const ctx = extractQueryContext({ trace: { requestId: 123, traceId: null } } as any);
    expect(ctx.trace).toEqual({});
  });

  it('preferences with non-string fields → empty preferences object', () => {
    const ctx = extractQueryContext({ preferences: { locale: 42, timezone: false } } as any);
    expect(ctx.preferences).toEqual({});
  });

  it('extensions as undefined → not included', () => {
    const ctx = extractQueryContext({ trace: { requestId: 'r' } });
    expect('extensions' in ctx).toBe(false);
  });

  it('defaults with only timeRange.from and to', () => {
    const ctx = extractQueryContext({ defaults: { timeRange: { from: 10, to: 20 } } });
    expect(ctx.defaults).toEqual({ timeRange: { from: 10, to: 20 } });
  });

  it('defaults empty object → defaults undefined', () => {
    const ctx = extractQueryContext({ defaults: {} });
    expect(ctx.defaults).toBeUndefined();
  });
});
