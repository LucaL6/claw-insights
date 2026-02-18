import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { DoctorModal } from '../DoctorModal';

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

describe('DoctorModal', () => {
  it('renders doctor title and description', () => {
    const { getByText } = render(<DoctorModal onClose={vi.fn()} />);
    expect(getByText('modal.doctor.title')).toBeDefined();
    expect(getByText('modal.doctor.desc')).toBeDefined();
  });

  it('renders with info variant (sky confirm button)', () => {
    const { getByText } = render(<DoctorModal onClose={vi.fn()} />);
    const btn = getByText('modal.doctor.confirm');
    expect(btn.style.backgroundColor).toContain('--sky');
  });

  it('renders checkboxes with correct defaults', () => {
    const { container } = render(<DoctorModal onClose={vi.fn()} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(4);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[2] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[3] as HTMLInputElement).checked).toBe(false);
  });

  it('toggles autoFix checkbox', () => {
    const { container } = render(<DoctorModal onClose={vi.fn()} />);
    const autoFix = container.querySelectorAll('input[type="checkbox"]')[3] as HTMLInputElement;
    expect(autoFix.checked).toBe(false);
    fireEvent.click(autoFix);
    expect(autoFix.checked).toBe(true);
  });

  it('calls run() with options on confirm', () => {
    const { getByText } = render(<DoctorModal onClose={vi.fn()} />);
    fireEvent.click(getByText('modal.doctor.confirm'));
    expect(mockRun).toHaveBeenCalledWith({
      options: { channelCheck: true, securityAudit: true, deepProbe: false, autoFix: false },
    });
  });
});
