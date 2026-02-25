import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('renders with doctor variant (themed confirm button)', () => {
    const { getByText } = render(<DoctorModal onClose={vi.fn()} />);
    const btn = getByText('modal.doctor.confirm');
    expect(btn.style.backgroundColor).toContain('--doctor-accent');
  });

  it('renders checkboxes with correct defaults', () => {
    const { container } = render(<DoctorModal onClose={vi.fn()} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false); // deep
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false); // fix
  });

  it('toggles fix checkbox', () => {
    const { container } = render(<DoctorModal onClose={vi.fn()} />);
    const fix = container.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
    expect(fix.checked).toBe(false);
    fireEvent.click(fix);
    expect(fix.checked).toBe(true);
  });

  it('calls run() with options on confirm', () => {
    const { getByText } = render(<DoctorModal onClose={vi.fn()} />);
    fireEvent.click(getByText('modal.doctor.confirm'));
    expect(mockRun).toHaveBeenCalledWith({
      options: { deep: false, fix: false },
    });
  });
});
