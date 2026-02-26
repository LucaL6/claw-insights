import { describe, expect, test } from 'vitest';

import { parseSnapshotRequest } from '../snapshot-types';

describe('parseSnapshotRequest', () => {
  test('returns defaults for empty body', () => {
    const req = parseSnapshotRequest({});
    expect(req).toEqual({
      layout: 'desktop',
      detail: 'standard',
      format: 'png',
      range: '6h',
      theme: 'dark',
      lang: 'en',
      section: 'dashboard',
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
    expect(() => parseSnapshotRequest({ format: 'pdf' })).toThrow('Invalid format');
  });

  test('throws on invalid range', () => {
    expect(() => parseSnapshotRequest({ range: '48h' })).toThrow('Invalid range');
  });

  test('should accept format=svg', () => {
    const req = parseSnapshotRequest({ format: 'svg' });
    expect(req.format).toBe('svg');
  });

  test('should default range to 6h', () => {
    const req = parseSnapshotRequest({});
    expect(req.range).toBe('6h');
  });

  test('should accept layout=mobile', () => {
    const req = parseSnapshotRequest({ layout: 'mobile' });
    expect(req.layout).toBe('mobile');
  });

  test('should default layout to desktop', () => {
    const req = parseSnapshotRequest({});
    expect(req.layout).toBe('desktop');
  });

  test('should accept section=logs', () => {
    const req = parseSnapshotRequest({ section: 'logs' });
    expect(req.section).toBe('logs');
  });

  test('should default section to dashboard', () => {
    const req = parseSnapshotRequest({});
    expect(req.section).toBe('dashboard');
  });

  test('throws on invalid layout', () => {
    expect(() => parseSnapshotRequest({ layout: 'tablet' })).toThrow('Invalid layout');
  });

  test('throws on invalid section', () => {
    expect(() => parseSnapshotRequest({ section: 'metrics' })).toThrow('Invalid section');
  });
});
