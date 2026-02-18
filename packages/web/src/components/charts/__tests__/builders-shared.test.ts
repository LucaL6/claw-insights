import { describe, it, expect } from 'vitest';
import { buildCategoryXAxis, tooltipHtml, areaGradient } from '../builders/shared';

describe('buildCategoryXAxis', () => {
  it('returns category axis with labels and interval', () => {
    const labels = ['0h', '1h', '2h', '3h', '4h', '5h'];
    const axis = buildCategoryXAxis(labels);
    expect(axis.type).toBe('category');
    expect(axis.data).toBe(labels);
    expect(axis.axisLabel?.interval).toBe(0); // ≤6 items → interval 0
  });

  it('increases interval for larger datasets', () => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    const axis = buildCategoryXAxis(labels);
    expect(axis.axisLabel?.interval).toBe(3); // ≤24 items → interval 3
  });
});

describe('tooltipHtml', () => {
  it('formats title + rows + footer', () => {
    const html = tooltipHtml({
      title: '12h',
      rows: [{ color: '#34d399', label: 'Sessions', value: '42' }],
      footer: 'some footer text',
    });
    expect(html).toContain('<b>12h</b>');
    expect(html).toContain('#34d399');
    expect(html).toContain('Sessions');
    expect(html).toContain('42');
    expect(html).toContain('some footer text');
  });

  it('works without footer', () => {
    const html = tooltipHtml({
      title: '3h',
      rows: [{ color: '#fff', label: 'X', value: '1' }],
    });
    expect(html).toContain('<b>3h</b>');
    expect(html).not.toContain('font-size:10px');
  });
});

describe('areaGradient', () => {
  it('returns linear gradient config', () => {
    const grad = areaGradient('#34d399', 0.25, 0.02);
    expect(grad.type).toBe('linear');
    expect(grad.colorStops).toHaveLength(2);
    expect(grad.colorStops[0].offset).toBe(0);
    expect(grad.colorStops[1].offset).toBe(1);
  });
});
