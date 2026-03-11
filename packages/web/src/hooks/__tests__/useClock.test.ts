import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useClock } from '../useClock';

const mockUseI18n = vi.fn();

vi.mock('../../i18n/context', () => ({
  useI18n: () => mockUseI18n(),
}));

describe('useClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseI18n.mockReturnValue({ lang: 'en' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockUseI18n.mockReset();
  });

  it('maps zh language to zh-CN locale and ticks on interval', () => {
    mockUseI18n.mockReturnValue({ lang: 'zh' });

    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('10:00');
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Sunday, 1 March');

    const { result, unmount } = renderHook(() => useClock(1000));

    expect(result.current).toEqual({ time: '10:00', date: 'Sunday, 1 March' });
    expect(timeSpy).toHaveBeenLastCalledWith('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    expect(dateSpy).toHaveBeenLastCalledWith('zh-CN', { weekday: 'long', day: 'numeric', month: 'long' });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(timeSpy).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('falls back to en-GB for unknown language', () => {
    mockUseI18n.mockReturnValue({ lang: 'fr' });

    const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('11:11');
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Monday, 2 March');

    const { result, unmount } = renderHook(() => useClock());

    expect(result.current.time).toBe('11:11');
    expect(timeSpy).toHaveBeenLastCalledWith('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    unmount();
  });
});
