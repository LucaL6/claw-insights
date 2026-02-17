import { describe, test, expect } from 'vitest';
import { parseSnapshotRequest } from '../types';

describe('parseSnapshotRequest', () => {
  test('returns defaults for empty body', () => {
    const req = parseSnapshotRequest({});
    expect(req).toEqual({
      layout: 'desktop', detail: 'standard', format: 'png',
      range: '1h', theme: 'dark', lang: 'en', section: 'dashboard',
    });
  });

  test('accepts valid mobile compact json request', () => {
    const req = parseSnapshotRequest({ layout: 'mobile', detail: 'compact', format: 'json', range: '6h' });
    expect(req.layout).toBe('mobile');
    expect(req.detail).toBe('compact');
    expect(req.format).toBe('json');
    expect(req.range).toBe('6h');
  });

  test('throws on invalid layout', () => {
    expect(() => parseSnapshotRequest({ layout: 'tablet' })).toThrow('Invalid layout');
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

  test('section ignored for mobile layout', () => {
    const req = parseSnapshotRequest({ layout: 'mobile', section: 'logs' });
    expect(req.section).toBe('dashboard');
  });
});
