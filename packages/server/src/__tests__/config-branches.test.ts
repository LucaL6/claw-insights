import { describe, expect,it } from 'vitest';

import { safeInt,safePort } from '../config.js';

describe('safePort branch coverage', () => {
  it('returns fallback when env is undefined', () => {
    expect(safePort(undefined, 80)).toBe(80);
  });

  it('returns fallback when env is empty string', () => {
    expect(safePort('', 80)).toBe(80);
  });

  it('returns fallback for non-numeric string', () => {
    expect(safePort('abc', 80)).toBe(80);
  });

  it('returns fallback for negative port', () => {
    expect(safePort('-1', 80)).toBe(80);
  });

  it('returns fallback for zero port', () => {
    expect(safePort('0', 80)).toBe(80);
  });

  it('returns fallback for port >= 65536', () => {
    expect(safePort('99999', 80)).toBe(80);
  });

  it('returns parsed port for valid value', () => {
    expect(safePort('3000', 80)).toBe(3000);
  });
});

describe('safeInt branch coverage', () => {
  it('returns fallback when env is undefined', () => {
    expect(safeInt(undefined, 0)).toBe(0);
  });

  it('returns fallback when env is empty string', () => {
    expect(safeInt('', 42)).toBe(42);
  });

  it('returns fallback for non-numeric string', () => {
    expect(safeInt('abc', 0)).toBe(0);
  });

  it('returns fallback for negative number', () => {
    expect(safeInt('-5', 0)).toBe(0);
  });

  it('returns parsed int for valid value', () => {
    expect(safeInt('7', 0)).toBe(7);
  });

  it('returns 0 for "0"', () => {
    expect(safeInt('0', 5)).toBe(0);
  });
});
