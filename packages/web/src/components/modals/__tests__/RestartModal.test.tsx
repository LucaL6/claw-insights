import { cleanup,fireEvent, render } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { RestartModal } from '../RestartModal';

vi.mock('../../../i18n/context', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockRun = vi.fn();
vi.mock('../useOperationMutation', () => ({
  useOperationMutation: () => ({ loading: false, error: null, run: mockRun }),
}));

afterEach(() => {
  cleanup();
  mockRun.mockClear();
});

describe('RestartModal', () => {
  it('renders restart title and description', () => {
    const { getByText } = render(<RestartModal onClose={vi.fn()} />);
    expect(getByText('modal.restart.title')).toBeDefined();
    expect(getByText('modal.restart.desc')).toBeDefined();
  });

  it('renders with warning variant (orange confirm button)', () => {
    const { getByText } = render(<RestartModal onClose={vi.fn()} />);
    const btn = getByText('modal.restart.confirm');
    expect(btn.style.backgroundColor).toContain('--orange');
  });

  it('shows command preview', () => {
    const { getByText } = render(<RestartModal onClose={vi.fn()} />);
    expect(getByText('modal.restart.command')).toBeDefined();
    expect(getByText('modal.restart.commandNote')).toBeDefined();
  });

  it('calls run() on confirm click', () => {
    const { getByText } = render(<RestartModal onClose={vi.fn()} />);
    fireEvent.click(getByText('modal.restart.confirm'));
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it('calls onClose on cancel click', () => {
    const onClose = vi.fn();
    const { getByText } = render(<RestartModal onClose={onClose} />);
    fireEvent.click(getByText('modal.cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
