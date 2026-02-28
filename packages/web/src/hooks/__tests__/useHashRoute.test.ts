import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useHashRoute } from '../useHashRoute';

describe('useHashRoute', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.location.hash = '';
  });

  it('defaults to dashboard when no hash', () => {
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route.page).toBe('dashboard');
    expect(result.current.route.params).toEqual({});
  });

  it('parses #logs as logs page', () => {
    window.location.hash = '#logs';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route.page).toBe('logs');
  });

  it('parses query params', () => {
    window.location.hash = '#logs?from=100&to=200';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route.page).toBe('logs');
    expect(result.current.route.params).toEqual({ from: '100', to: '200' });
  });

  it('treats unknown paths as dashboard', () => {
    window.location.hash = '#metrics';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route.page).toBe('dashboard');
  });

  it('handles query param with no value', () => {
    window.location.hash = '#logs?flag';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route.params).toEqual({ flag: 'undefined' });
  });

  it('navigate sets hash and updates route on hashchange', () => {
    const { result } = renderHook(() => useHashRoute());
    act(() => {
      result.current.navigate('logs?type=error');
    });
    // Trigger hashchange manually (happy-dom may not auto-fire)
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.route.page).toBe('logs');
    expect(result.current.route.params).toEqual({ type: 'error' });
  });
});
