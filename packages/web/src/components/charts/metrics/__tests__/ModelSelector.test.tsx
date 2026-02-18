import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/render';
import { ModelSelector } from '../ModelSelector';

afterEach(cleanup);

const baseProps = {
  models: ['gpt-4', 'claude-3'],
  selected: null as string | null,
  onChange: vi.fn(),
};

describe('ModelSelector', () => {
  it('returns null when models has 0 items', () => {
    const { container } = renderWithProviders(
      <ModelSelector models={[]} selected={null} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when models has 1 item', () => {
    const { container } = renderWithProviders(
      <ModelSelector models={['gpt-4']} selected={null} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders "All" button and model buttons when models > 1', () => {
    renderWithProviders(<ModelSelector {...baseProps} />);
    // "All" button from i18n key metrics.modelAll
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3); // All + 2 models
  });

  it('applies active style to "All" when selected is null', () => {
    renderWithProviders(<ModelSelector {...baseProps} selected={null} />);
    const allBtn = screen.getAllByRole('button')[0];
    expect(allBtn.style.backgroundColor).toBeTruthy();
  });

  it('applies active style to selected model button', () => {
    renderWithProviders(<ModelSelector {...baseProps} selected="gpt-4" />);
    const allBtn = screen.getAllByRole('button')[0];
    // "All" should NOT have active style
    expect(allBtn.style.backgroundColor).toBe('');
  });

  it('calls onChange(null) when "All" button clicked', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModelSelector {...baseProps} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange(model) when an inactive model is clicked', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModelSelector {...baseProps} selected={null} onChange={onChange} />);
    // Click second button (first model)
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onChange).toHaveBeenCalledWith('gpt-4');
  });

  it('calls onChange(null) when the active model is clicked (deselect)', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModelSelector {...baseProps} selected="gpt-4" onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders color dots for each model', () => {
    const { container } = renderWithProviders(<ModelSelector {...baseProps} />);
    const dots = container.querySelectorAll('span.inline-block');
    expect(dots.length).toBe(2);
    // Each dot should have a background color
    dots.forEach((dot) => {
      expect((dot as HTMLElement).style.backgroundColor).toBeTruthy();
    });
  });
});
