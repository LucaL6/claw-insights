import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModalIcon } from '../ModalIcon';

describe('ModalIcon', () => {
  it('renders children with the given color', () => {
    const { getByText } = render(<ModalIcon color="var(--red)"><span>X</span></ModalIcon>);
    const span = getByText('X').parentElement!;
    expect(span.style.color).toBe('var(--red)');
  });

  it('renders the icon wrapper with expected classes', () => {
    const { container } = render(<ModalIcon color="var(--sky)"><span>I</span></ModalIcon>);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('rounded-xl');
    expect(wrapper.className).toContain('flex');
  });

  it('renders children inside the wrapper', () => {
    const { getByText } = render(<ModalIcon color="var(--sky)"><span>Icon</span></ModalIcon>);
    expect(getByText('Icon')).toBeDefined();
  });
});
