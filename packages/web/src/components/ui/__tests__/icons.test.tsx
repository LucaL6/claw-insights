import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { RestartIcon, DoctorIcon, DownloadIcon, CameraIcon, SpinnerIcon, ChevronDownIcon } from '../icons';

const icons = [
  ['RestartIcon', RestartIcon],
  ['DoctorIcon', DoctorIcon],
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
    const { container } = renderWithProviders(<RestartIcon className="w-5 h-5" />);
    expect((container.querySelector('svg') as SVGElement).getAttribute('class')).toContain('w-5');
  });
});
