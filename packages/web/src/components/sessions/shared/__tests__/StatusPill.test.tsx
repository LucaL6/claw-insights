import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusPill } from '../StatusPill';

afterEach(cleanup);

describe('StatusPill', () => {
  it('renders label text', () => {
    const { getByText } = render(<StatusPill variant="running" label="运行中" />);
    expect(getByText('运行中')).toBeDefined();
  });

  it('applies starting variant styles', () => {
    const { container } = render(<StatusPill variant="starting" label="Starting..." />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.style.backgroundColor).toBe('var(--status-pill-starting-bg)');
    expect(pill.style.color).toBe('var(--status-pill-starting-text)');
  });

  it('applies running variant styles', () => {
    const { container } = render(<StatusPill variant="running" label="Running..." />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.style.backgroundColor).toBe('var(--status-pill-running-bg)');
  });

  it('applies idle variant styles', () => {
    const { container } = render(<StatusPill variant="idle" label="Idle" />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.style.backgroundColor).toBe('var(--status-pill-idle-bg)');
  });

  it('applies done variant styles', () => {
    const { container } = render(<StatusPill variant="done" label="Done" />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.style.backgroundColor).toBe('var(--status-pill-done-bg)');
  });

  it('applies failed variant styles', () => {
    const { container } = render(<StatusPill variant="failed" label="Failed" />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.style.backgroundColor).toBe('var(--status-pill-failed-bg)');
  });

  it('shows spinner icon for starting variant', () => {
    const { container } = render(<StatusPill variant="starting" label="启动中" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('does not show spinner for running variant', () => {
    const { container } = render(<StatusPill variant="running" label="运行中" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeNull();
  });
});
