import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CommandPreview } from '../CommandPreview';

describe('CommandPreview', () => {
  it('renders all lines', () => {
    const { getByText } = render(<CommandPreview lines={['npm update', '# note']} />);
    expect(getByText('npm update')).toBeDefined();
    expect(getByText('# note')).toBeDefined();
  });

  it('applies comment styling to lines starting with #', () => {
    const { getByText } = render(<CommandPreview lines={['# comment']} />);
    const el = getByText('# comment');
    expect(el.className).toContain('text-fg-dim');
  });

  it('does not apply comment styling to regular lines', () => {
    const { getByText } = render(<CommandPreview lines={['run cmd']} />);
    const el = getByText('run cmd');
    expect(el.className ?? '').not.toContain('text-fg-dim');
  });
});
