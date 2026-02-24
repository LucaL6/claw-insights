import { describe, test, expect } from 'vitest';
import { parseSnapshotRequest } from '../snapshot-types';

describe('parseSnapshotRequest', () => {
  test('returns defaults for empty body', () => {
    const req = parseSnapshotRequest({});
    expect(req).toEqual({
      detail: 'standard',
      format: 'png',
      range: '1h',
      theme: 'dark',
      lang: 'en',
    });
  });

  test('accepts valid compact json request', () => {
    const req = parseSnapshotRequest({ detail: 'compact', format: 'json', range: '6h' });
    expect(req.detail).toBe('compact');
    expect(req.format).toBe('json');
    expect(req.range).toBe('6h');
  });

  test('throws on invalid detail', () => {
    expect(() => parseSnapshotRequest({ detail: 'ultra' })).toThrow('Invalid detail');
  });

  test('throws on invalid format', () => {
    expect(() => parseSnapshotRequest({ format: 'svg' })).toThrow('Invalid format');
  });

  test('throws on invalid range', () => {
    expect(() => parseSnapshotRequest({ range: '48h' })).toThrow('Invalid range');
  });

  test('silently ignores removed layout/section params', () => {
    const req = parseSnapshotRequest({ layout: 'mobile', section: 'logs', detail: 'full' });
    expect(req.detail).toBe('full');
    expect(((req as unknown as Record<string, unknown>)).layout).toBeUndefined();
    expect(((req as unknown as Record<string, unknown>)).section).toBeUndefined();
  });
});
