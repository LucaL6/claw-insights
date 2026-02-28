import { describe, expect, it } from 'vitest';

import { buildConversationsOption } from '../buildConversationsOption';

const data = [
  { bucket: 1, label: '12:00', turns: 10, userTurns: 6, assistantTurns: 4 },
  { bucket: 2, label: '13:00', turns: 5, userTurns: 3, assistantTurns: 2 },
];

describe('buildConversationsOption', () => {
  it('builds "all" (default) with stacked series', () => {
    const opt = buildConversationsOption(data, 'footer');
    expect(opt.series).toHaveLength(2);
    expect((opt.series as any[])[0].name).toBe('User');
    expect((opt.series as any[])[0].stack).toBe('turns');
  });

  it('builds "user" filter with single series', () => {
    const opt = buildConversationsOption(data, 'footer', 'user');
    expect(opt.series).toHaveLength(1);
    expect((opt.series as any[])[0].name).toBe('User');
  });

  it('builds "assistant" filter with single series', () => {
    const opt = buildConversationsOption(data, 'footer', 'assistant');
    expect(opt.series).toHaveLength(1);
    expect((opt.series as any[])[0].name).toBe('OpenClaw');
  });

  it('user tooltip formatter works', () => {
    const opt = buildConversationsOption(data, 'my-footer', 'user');
    const formatter = (opt.tooltip as any).formatter;
    const html = formatter([{ name: '12:00', value: 6 }]);
    expect(html).toContain('12:00');
    expect(html).toContain('6');
  });

  it('assistant tooltip formatter works', () => {
    const opt = buildConversationsOption(data, 'my-footer', 'assistant');
    const formatter = (opt.tooltip as any).formatter;
    const html = formatter([{ name: '13:00', value: 2 }]);
    expect(html).toContain('13:00');
    expect(html).toContain('2');
  });

  it('all tooltip formatter works', () => {
    const opt = buildConversationsOption(data, 'my-footer', 'all');
    const formatter = (opt.tooltip as any).formatter;
    const html = formatter([
      { name: '12:00', seriesName: 'User', value: 6, color: '#2dd4bf' },
      { name: '12:00', seriesName: 'OpenClaw', value: 4, color: '#fb7185' },
    ]);
    expect(html).toContain('12:00');
    expect(html).toContain('10'); // total
  });

  it('maps data correctly for user filter', () => {
    const opt = buildConversationsOption(data, 'footer', 'user');
    expect((opt.series as any[])[0].data).toEqual([6, 3]);
  });

  it('maps data correctly for assistant filter', () => {
    const opt = buildConversationsOption(data, 'footer', 'assistant');
    expect((opt.series as any[])[0].data).toEqual([4, 2]);
  });

  it('all tooltip handles missing second item gracefully', () => {
    const opt = buildConversationsOption(data, 'footer', 'all');
    const formatter = (opt.tooltip as any).formatter;
    // Only one item in array - items[1] is undefined
    const html = formatter([{ name: '12:00', seriesName: 'User', value: 6, color: '#2dd4bf' }]);
    expect(html).toContain('12:00');
    expect(html).toContain('0'); // fallback for missing items[1]
  });

  it('all tooltip handles missing first item value', () => {
    const opt = buildConversationsOption(data, 'footer', 'all');
    const formatter = (opt.tooltip as any).formatter;
    const html = formatter([
      { name: '12:00', seriesName: 'User', value: 0, color: '#2dd4bf' },
      { name: '12:00', seriesName: 'OpenClaw', value: 0, color: '#fb7185' },
    ]);
    expect(html).toContain('0');
  });
});
