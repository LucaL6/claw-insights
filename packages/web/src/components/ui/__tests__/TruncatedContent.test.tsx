import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TruncatedContent } from '../TruncatedContent';

// Mock ResizeObserver
const observeFn = vi.fn();
const disconnectFn = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observeFn;
      unobserve = vi.fn();
      disconnect = disconnectFn;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TruncatedContent', () => {
  it('renders children without truncation when content is short', () => {
    // scrollHeight <= maxHeight → no button
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 40,
    });

    render(
      <TruncatedContent maxHeight={80}>
        <p>Short content</p>
      </TruncatedContent>,
    );

    expect(screen.getByText('Short content')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows expand button when content overflows maxHeight', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 200,
    });

    render(
      <TruncatedContent maxHeight={80}>
        <p>Tall content</p>
      </TruncatedContent>,
    );

    const btn = screen.getByRole('button', { name: '↓ show more' });
    expect(btn).toBeTruthy();
  });

  it('expands on click and shows collapse button', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 200,
    });

    render(
      <TruncatedContent maxHeight={80}>
        <p>Tall content</p>
      </TruncatedContent>,
    );

    fireEvent.click(screen.getByRole('button', { name: '↓ show more' }));
    expect(screen.getByRole('button', { name: '↑ show less' })).toBeTruthy();
  });

  it('collapses on second click', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 200,
    });

    render(
      <TruncatedContent maxHeight={80}>
        <p>Tall content</p>
      </TruncatedContent>,
    );

    const btn = screen.getByRole('button', { name: '↓ show more' });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: '↑ show less' }));
    expect(screen.getByRole('button', { name: '↓ show more' })).toBeTruthy();
  });
});
