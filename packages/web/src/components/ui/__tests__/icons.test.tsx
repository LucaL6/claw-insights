import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { CameraIcon, ChevronDownIcon, DownloadIcon, SpinnerIcon } from '../icons';

const icons = [
  ['DownloadIcon', DownloadIcon],
  ['CameraIcon', CameraIcon],
  ['SpinnerIcon', SpinnerIcon],
  ['ChevronDownIcon', ChevronDownIcon],
] as const;

describe('Icon components', () => {
  for (const [name, Icon] of icons) {
    it(`${name} renders an SVG`, () => {
      const { container } = renderWithProviders(<Icon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  }

  it('accepts custom className', () => {
    const { container } = renderWithProviders(<DownloadIcon className="w-5 h-5" />);
    expect((container.querySelector('svg') as SVGElement).getAttribute('class')).toContain('w-5');
  });
});
