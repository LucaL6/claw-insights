import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { Tooltip } from '../Tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    const { getByText } = renderWithProviders(
      <Tooltip text="hint">
        <button>Click me</button>
      </Tooltip>,
    );
    expect(getByText('Click me')).toBeDefined();
  });

  it('renders tooltip text', () => {
    const { getByText } = renderWithProviders(
      <Tooltip text="Restart the gateway">
        <button>Restart</button>
      </Tooltip>,
    );
    expect(getByText('Restart the gateway')).toBeDefined();
  });

  it('renders detail when provided', () => {
    const { getByText } = renderWithProviders(
      <Tooltip text="Main" detail="Extra info">
        <button>Btn</button>
      </Tooltip>,
    );
    expect(getByText('Extra info')).toBeDefined();
  });

  it('does not render detail when omitted', () => {
    const { container } = renderWithProviders(
      <Tooltip text="No detail tooltip">
        <button>Btn</button>
      </Tooltip>,
    );
    const bubble = container.querySelector('[role="tooltip"]');
    expect(bubble?.children.length).toBe(1);
  });

  it('applies right alignment class', () => {
    const { container } = renderWithProviders(
      <Tooltip text="hint" align="right">
        <button>Btn</button>
      </Tooltip>,
    );
    const bubble = container.querySelector('[role="tooltip"]');
    expect(bubble?.className).toContain('right-0');
  });

  // a11y tests
  it('has role="tooltip" on the tooltip element', () => {
    const { container } = renderWithProviders(
      <Tooltip text="Help text">
        <button>Btn</button>
      </Tooltip>,
    );
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toContain('Help text');
  });

  it('links wrapper to tooltip via aria-describedby', () => {
    const { container } = renderWithProviders(
      <Tooltip text="Accessible">
        <button>Btn</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector('[aria-describedby]');
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(wrapper).toBeTruthy();
    expect(tooltip).toBeTruthy();
    expect(wrapper?.getAttribute('aria-describedby')).toBe(tooltip?.getAttribute('id'));
  });

  it('includes focus-within visibility class for keyboard access', () => {
    const { container } = renderWithProviders(
      <Tooltip text="Focus">
        <button>Btn</button>
      </Tooltip>,
    );
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.className).toContain('group-focus-within/tip:visible');
  });

  it('includes motion-reduce class', () => {
    const { container } = renderWithProviders(
      <Tooltip text="Motion">
        <button>Btn</button>
      </Tooltip>,
    );
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip?.className).toContain('motion-reduce:transition-none');
  });

  it('tooltip remains hoverable via wrapper when button is disabled', () => {
    const { container } = renderWithProviders(
      <Tooltip text="Disabled hint">
        <button disabled>Disabled</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector('[aria-describedby]') as HTMLElement;
    // Wrapper span should still exist and contain the tooltip
    expect(wrapper).toBeTruthy();
    fireEvent.mouseEnter(wrapper);
    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).toBeTruthy();
  });
});
