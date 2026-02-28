import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useIsBelowMd } from '../useIsBelowMd';

function mockViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.matchMedia = (query: string) =>
    ({
      matches: width < 768,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe('useIsBelowMd', () => {
  afterEach(() => {
    mockViewport(1024);
  });

  it('returns true when viewport is below 768px', () => {
    mockViewport(600);
    const { result } = renderHook(() => useIsBelowMd());
    expect(result.current).toBe(true);
  });

  it('returns false when viewport is at or above 768px', () => {
    mockViewport(1024);
    const { result } = renderHook(() => useIsBelowMd());
    expect(result.current).toBe(false);
  });
});
