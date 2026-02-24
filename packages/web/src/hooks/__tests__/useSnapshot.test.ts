import { act,renderHook } from '@testing-library/react';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import { useSnapshot } from '../useSnapshot';

describe('useSnapshot', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:test');
    (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts with snapshotting=false', () => {
    const { result } = renderHook(() => useSnapshot());
    expect(result.current.snapshotting).toBe(false);
    expect(typeof result.current.takeSnapshot).toBe('function');
  });

  it('takeSnapshot fetches and triggers download', async () => {
    const mockBlob = new Blob(['png']);
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
      headers: new Headers({ 'X-Filename': 'claw-insights-standard-1h-dark-2026-02-23-13-15.png' }),
    } as unknown as Response);

    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (String(tagName).toLowerCase() === 'a') {
        return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
      }
      return origCreate(tagName, options);
    }) as typeof document.createElement);

    const { result } = renderHook(() => useSnapshot());
    await act(async () => {
      await result.current.takeSnapshot({ section: 'dashboard', range: 'ONE_HOUR', theme: 'dark', lang: 'en' });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/snapshot', expect.objectContaining({ method: 'POST' }));
    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.snapshotting).toBe(false);
  });

  it('maps range to short form', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, blob: async () => new Blob(), headers: new Headers() } as unknown as Response);
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (String(tagName).toLowerCase() === 'a') {return { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;}
      return origCreate(tagName, options);
    }) as typeof document.createElement);

    const { result } = renderHook(() => useSnapshot());
    await act(async () => {
      await result.current.takeSnapshot({ section: 'logs', range: 'SIX_HOUR', theme: 'light', lang: 'zh' });
    });

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.range).toBe('6h');
  });

  it('uses 24h fallback for unknown range', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, blob: async () => new Blob(), headers: new Headers() } as unknown as Response);
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (String(tagName).toLowerCase() === 'a') {return { click: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;}
      return origCreate(tagName, options);
    }) as typeof document.createElement);

    const { result } = renderHook(() => useSnapshot());
    await act(async () => {
      await result.current.takeSnapshot({ section: 'dashboard', range: 'UNKNOWN', theme: 'dark', lang: 'en' });
    });

    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.range).toBe('24h');
  });

  it('handles fetch failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false } as Response);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSnapshot());
    await act(async () => {
      await result.current.takeSnapshot({ section: 'dashboard', range: 'ONE_HOUR', theme: 'dark', lang: 'en' });
    });

    expect(result.current.snapshotting).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
