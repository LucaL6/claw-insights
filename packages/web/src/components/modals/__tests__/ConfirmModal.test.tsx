import { describe, it, expect, afterEach } from 'bun:test';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { ConfirmModal } from '../ConfirmModal';

afterEach(cleanup);

describe('ConfirmModal', () => {
  const noop = () => {};

  it('F5.4.1: renders backdrop overlay', () => {
    const { container } = render(
      <ConfirmModal title="Test" onConfirm={noop} onCancel={noop}>Body</ConfirmModal>
    );
    expect(container.querySelector('.fixed.inset-0')).toBeDefined();
  });

  it('F5.4.2: calls onCancel when backdrop clicked', () => {
    let cancelled = false;
    const { container } = render(
      <ConfirmModal title="Test" onConfirm={noop} onCancel={() => { cancelled = true; }}>Body</ConfirmModal>
    );
    fireEvent.click(container.querySelector('.fixed.inset-0')!);
    expect(cancelled).toBe(true);
  });

  it('does NOT close when modal body clicked', () => {
    let cancelled = false;
    const { getByText } = render(
      <ConfirmModal title="Test" onConfirm={noop} onCancel={() => { cancelled = true; }}>Body</ConfirmModal>
    );
    fireEvent.click(getByText('Body'));
    expect(cancelled).toBe(false);
  });

  it('calls onConfirm when confirm button clicked', () => {
    let confirmed = false;
    const { getByText } = render(
      <ConfirmModal title="Test" confirmText="Go" onConfirm={() => { confirmed = true; }} onCancel={noop}>Body</ConfirmModal>
    );
    fireEvent.click(getByText('Go'));
    expect(confirmed).toBe(true);
  });

  it('shows loading state', () => {
    const { getByText } = render(
      <ConfirmModal title="Test" loading={true} onConfirm={noop} onCancel={noop}>Body</ConfirmModal>
    );
    expect(getByText('Running...')).toBeDefined();
  });

  it('disables confirm button when loading', () => {
    const { getByText } = render(
      <ConfirmModal title="Test" loading={true} onConfirm={noop} onCancel={noop}>Body</ConfirmModal>
    );
    expect(getByText('Running...').hasAttribute('disabled')).toBe(true);
  });
});
