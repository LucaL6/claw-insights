import type { SatoriNode } from './helpers.js';

export function LighthouseIcon(color: string, size = 20): SatoriNode {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 48 48',
      fill: 'none',
      stroke: color,
      strokeWidth: 2.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      children: [
        { type: 'line', props: { x1: 14, y1: 42, x2: 34, y2: 42 } },
        { type: 'path', props: { d: 'M20 42 L22 18 H26 L28 42' } },
        { type: 'rect', props: { x: 21, y: 12, width: 6, height: 6, rx: 1, fill: color, opacity: 0.2 } },
        { type: 'path', props: { d: 'M21 12 Q24 8 27 12' } },
      ],
    },
  };
}
