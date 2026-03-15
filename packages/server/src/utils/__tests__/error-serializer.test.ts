import { describe, expect, it } from 'vitest';

import { serializeError } from '../error-serializer.js';

describe('serializeError', () => {
  it('serializes standard Error with message and stack', () => {
    const err = new Error('test error');
    const result = serializeError(err);
    expect(result.message).toBe('test error');
    expect(result.stack).toContain('test error');
    expect(result.type).toBe('Error');
  });
  it('serializes TypeError', () => {
    const err = new TypeError('bad type');
    const result = serializeError(err);
    expect(result.message).toBe('bad type');
    expect(result.type).toBe('TypeError');
  });
  it('serializes string errors', () => {
    const result = serializeError('string error');
    expect(result.message).toBe('string error');
    expect(result.type).toBe('string');
  });
  it('serializes null/undefined', () => {
    expect(serializeError(null).message).toBe('null');
    expect(serializeError(undefined).message).toBe('undefined');
  });
  it('serializes plain objects', () => {
    const result = serializeError({ code: 'FAIL', detail: 'oops' });
    expect(result.message).toContain('FAIL');
    expect(result.type).toBe('object');
  });
  it('serializes NAPI errors with non-enumerable properties', () => {
    const err = new Error('napi error');
    Object.defineProperty(err, 'code', { value: 'ERR_NAPI', enumerable: false });
    const result = serializeError(err);
    expect(result.message).toBe('napi error');
  });
  it('handles circular references safely', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = serializeError(obj);
    expect(result.type).toBe('object');
    expect(result.message).toBeDefined();
  });
  it('handles BigInt values', () => {
    const result = serializeError({ code: BigInt(42) });
    expect(result.type).toBe('object');
    expect(result.message).toBeDefined();
  });
});
