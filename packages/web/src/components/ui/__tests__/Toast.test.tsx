import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ToastContainer } from '../Toast';
import { showToast } from '../toast-store';

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
});
