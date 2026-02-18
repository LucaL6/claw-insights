import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useScreenshot } from '../useScreenshot';

describe('useScreenshot', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    (URL as any).createObjectURL = vi.fn(() => 'blob:test');
    (URL as any).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts with screenshotting=false', () => {
    const { result } = renderHook(() => useScreenshot());
    expect(result.current.screenshotting).toBe(false);
    expect(typeof result.current.takeScreenshot).toBe('function');
  });

  it('takeScreenshot fetches and triggers download', async () => {
    const mockBlob = new Blob(['png']);
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    });

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: any, options?: any) => {
      if (String(tagName).toLowerCase() === 'a') {
        return { click: clickSpy, href: '', download: '' } as any;
      }
      return origCreate(tagName as any, options as any);
    }) as any);

    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.takeScreenshot({ section: 'dashboard', range: 'ONE_HOUR', theme: 'dark', lang: 'en' });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/snapshot', expect.objectContaining({ method: 'POST' }));
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.screenshotting).toBe(false);
  });

  it('maps range to short form', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: any, options?: any) => {
      if (String(tagName).toLowerCase() === 'a') return { click: vi.fn(), href: '', download: '' } as any;
      return origCreate(tagName as any, options as any);
    }) as any);

    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.takeScreenshot({ section: 'logs', range: 'SIX_HOUR', theme: 'light', lang: 'zh' });
    });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.range).toBe('6h');
  });

  it('uses 24h fallback for unknown range', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: any, options?: any) => {
      if (String(tagName).toLowerCase() === 'a') return { click: vi.fn(), href: '', download: '' } as any;
      return origCreate(tagName as any, options as any);
    }) as any);

    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.takeScreenshot({ section: 'dashboard', range: 'UNKNOWN', theme: 'dark', lang: 'en' });
    });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.range).toBe('24h');
  });

  it('handles fetch failure', async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.takeScreenshot({ section: 'dashboard', range: 'ONE_HOUR', theme: 'dark', lang: 'en' });
    });

    expect(result.current.screenshotting).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
