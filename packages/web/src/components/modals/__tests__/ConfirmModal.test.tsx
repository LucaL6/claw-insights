import { cleanup,fireEvent, render } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { ConfirmModal } from '../ConfirmModal';

vi.mock('../../../i18n/context', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

afterEach(cleanup);

describe('ConfirmModal', () => {
  const defaults = {
    title: 'Test',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    children: <p>Content</p>,
  };

  it('renders backdrop overlay', () => {
    const { container } = render(<ConfirmModal {...defaults}>Body</ConfirmModal>);
    expect(container.querySelector('.fixed.inset-0')).toBeDefined();
  });

  it('calls onCancel when backdrop clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmModal {...defaults} onCancel={onCancel}>Body</ConfirmModal>
    );
    fireEvent.click(container.querySelector('.fixed.inset-0')!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does NOT close when modal body clicked', () => {
    const onCancel = vi.fn();
    const { getByText } = render(
      <ConfirmModal {...defaults} onCancel={onCancel}>Body</ConfirmModal>
    );
    fireEvent.click(getByText('Body'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    const { getByText } = render(
      <ConfirmModal {...defaults} confirmText="Go" onConfirm={onConfirm}>Body</ConfirmModal>
    );
    fireEvent.click(getByText('Go'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('renders with danger variant styling', () => {
    const { getByText } = render(
      <ConfirmModal {...defaults} variant="danger" confirmText="Delete">Body</ConfirmModal>
    );
    const btn = getByText('Delete');
    expect(btn.style.backgroundColor).toContain('--red');
  });

  it('renders with warning variant styling', () => {
    const { getByText } = render(
      <ConfirmModal {...defaults} variant="warning" confirmText="Restart">Body</ConfirmModal>
    );
    const btn = getByText('Restart');
    expect(btn.style.backgroundColor).toContain('--orange');
  });

  it('renders with success variant styling', () => {
    const { getByText } = render(
      <ConfirmModal {...defaults} variant="success" confirmText="Go">Body</ConfirmModal>
    );
    const btn = getByText('Go');
    expect(btn.style.backgroundColor).toContain('--emerald');
  });

  it('renders with info variant styling (default)', () => {
    const { getByText } = render(
      <ConfirmModal {...defaults} confirmText="OK">Body</ConfirmModal>
    );
    const btn = getByText('OK');
    expect(btn.style.backgroundColor).toContain('--sky');
  });

  it('shows i18n cancel text', () => {
    const { getByText } = render(<ConfirmModal {...defaults}>Body</ConfirmModal>);
    expect(getByText('modal.cancel')).toBeDefined();
  });

  it('shows loading text when loading', () => {
    const { getByText } = render(<ConfirmModal {...defaults} loading>Body</ConfirmModal>);
    expect(getByText('modal.running')).toBeDefined();
  });

  it('disables confirm button when loading', () => {
    const { getByText } = render(<ConfirmModal {...defaults} loading>Body</ConfirmModal>);
    expect(getByText('modal.running').hasAttribute('disabled')).toBe(true);
  });

  it('shows error message when error is set', () => {
    const { getByText } = render(
      <ConfirmModal {...defaults} error="Something failed">Body</ConfirmModal>
    );
    expect(getByText('Something failed')).toBeDefined();
  });
});
