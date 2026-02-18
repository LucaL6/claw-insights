import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/render';
import { RangePicker } from '../GranularityPicker';

afterEach(cleanup);

describe('RangePicker', () => {
  it('renders all range buttons', () => {
    const { getByText } = renderWithProviders(
      <RangePicker value="ONE_HOUR" onChange={() => {}} />,
    );
    expect(getByText('1h')).toBeDefined();
    expect(getByText('6h')).toBeDefined();
    expect(getByText('12h')).toBeDefined();
    expect(getByText('24h')).toBeDefined();
  });

  it('highlights the selected range', () => {
    const { getByText } = renderWithProviders(
      <RangePicker value="SIX_HOUR" onChange={() => {}} />,
    );
    const btn = getByText('6h');
    expect(btn.style.backgroundColor).toBe('var(--toggle-sort-bg)');
    const other = getByText('1h');
    expect(other.style.backgroundColor).toBe('');
  });

  it('calls onChange when a different range is clicked', () => {
    const onChange = vi.fn();
    const { getByText } = renderWithProviders(
      <RangePicker value="ONE_HOUR" onChange={onChange} />,
    );
    fireEvent.click(getByText('12h'));
    expect(onChange).toHaveBeenCalledWith('TWELVE_HOUR');
  });
});
