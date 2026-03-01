import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ToastContainer } from '../Toast';
import { dismissToast, replaceToast, showToast } from '../toast-store';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    const { container } = renderWithProviders(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('shows error toast', () => {
    renderWithProviders(<ToastContainer />);
    act(() => {
      showToast('Something went wrong', 'error');
    });
    expect(screen.getByText(/Something went wrong/)).toBeDefined();
  });

  it('shows success toast', () => {
    renderWithProviders(<ToastContainer />);
    act(() => {
      showToast('Done!', 'success');
    });
    expect(screen.getByText(/Done!/)).toBeDefined();
  });

  it('auto-removes toast after 4s', () => {
    renderWithProviders(<ToastContainer />);
    act(() => {
      showToast('Temp', 'success');
    });
    expect(screen.getByText(/Temp/)).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText(/Temp/)).toBeNull();
  });

  it('shows multiple toasts', () => {
    renderWithProviders(<ToastContainer />);
    act(() => {
      showToast('First', 'error');
      showToast('Second', 'success');
    });
    expect(screen.getByText(/First/)).toBeDefined();
    expect(screen.getByText(/Second/)).toBeDefined();
  });

  it('shows loading toast and does NOT auto-dismiss', () => {
    renderWithProviders(<ToastContainer />);
    act(() => {
      showToast('Loading…', 'loading');
    });
    expect(screen.getByText(/Loading…/)).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Still visible after 10s — loading toasts persist
    expect(screen.getByText(/Loading…/)).toBeDefined();
  });

  it('dismisses toast via dismissToast', () => {
    renderWithProviders(<ToastContainer />);
    let id: number;
    act(() => {
      id = showToast('Dismissable', 'loading');
    });
    expect(screen.getByText(/Dismissable/)).toBeDefined();
    act(() => {
      dismissToast(id);
    });
    expect(screen.queryByText(/Dismissable/)).toBeNull();
  });

  it('replaces toast via replaceToast', () => {
    renderWithProviders(<ToastContainer />);
    let id: number;
    act(() => {
      id = showToast('Loading…', 'loading');
    });
    expect(screen.getByText(/Loading…/)).toBeDefined();
    act(() => {
      replaceToast(id, 'Done!', 'success');
    });
    expect(screen.queryByText(/Loading…/)).toBeNull();
    expect(screen.getByText(/Done!/)).toBeDefined();
  });

  it('auto-dismisses replaced toast when type is not loading', () => {
    renderWithProviders(<ToastContainer />);
    let id: number;
    act(() => {
      id = showToast('Wait…', 'loading');
    });
    act(() => {
      replaceToast(id, 'Finished', 'success');
    });
    expect(screen.getByText(/Finished/)).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText(/Finished/)).toBeNull();
  });

  it('does NOT auto-dismiss replaced toast when type is loading', () => {
    renderWithProviders(<ToastContainer />);
    let id: number;
    act(() => {
      id = showToast('Step 1', 'loading');
    });
    act(() => {
      replaceToast(id, 'Step 2', 'loading');
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText(/Step 2/)).toBeDefined();
  });
});
