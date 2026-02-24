import { cleanup,fireEvent, render } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { UpdateModal } from '../UpdateModal';

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

describe('UpdateModal', () => {
  const props = { onClose: vi.fn(), currentVersion: '1.0.0', latestVersion: '2.0.0' };

  it('renders update title', () => {
    const { getByText } = render(<UpdateModal {...props} />);
    expect(getByText('modal.update.title')).toBeDefined();
  });

  it('shows version info', () => {
    const { getByText } = render(<UpdateModal {...props} />);
    expect(getByText('1.0.0 → 2.0.0')).toBeDefined();
  });

  it('renders with success variant (emerald confirm button)', () => {
    const { getByText } = render(<UpdateModal {...props} />);
    const btn = getByText('modal.update.confirm');
    expect(btn.style.backgroundColor).toContain('--emerald');
  });

  it('shows command preview', () => {
    const { getByText } = render(<UpdateModal {...props} />);
    expect(getByText('modal.update.command')).toBeDefined();
  });

  it('calls run() on confirm click', () => {
    const { getByText } = render(<UpdateModal {...props} />);
    fireEvent.click(getByText('modal.update.confirm'));
    expect(mockRun).toHaveBeenCalledOnce();
  });
});
