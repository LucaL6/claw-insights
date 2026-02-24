import { describe, expect,it } from 'vitest';

import { getModelColor, MODEL_COLORS,shortModelName } from '../model-utils';

describe('getModelColor', () => {
  it('returns sky for opus', () => expect(getModelColor('claude-opus-4')).toBe(MODEL_COLORS.opus));
  it('returns violet for sonnet', () => expect(getModelColor('claude-sonnet-3-5')).toBe(MODEL_COLORS.sonnet));
  it('returns emerald for haiku', () => expect(getModelColor('claude-haiku-3')).toBe(MODEL_COLORS.haiku));
  it('returns orange for gpt', () => expect(getModelColor('gpt-4o')).toBe(MODEL_COLORS.gpt));
  it('returns zinc fallback for unknown', () => expect(getModelColor('llama-70b')).toBe('#71717a'));

  it('returns orange-500 for gpt-5.3-codex', () => {
    expect(getModelColor('gpt-5.3-codex')).toBe(MODEL_COLORS['5.3-codex']);
    expect(getModelColor('gpt-5.3-codex')).toBe('#f97316');
  });

  it('returns orange-300 for gpt-5.2-codex', () => {
    expect(getModelColor('gpt-5.2-codex')).toBe(MODEL_COLORS['5.2-codex']);
    expect(getModelColor('gpt-5.2-codex')).toBe('#fdba74');
  });

  it('returns emerald for minimax', () => {
    expect(getModelColor('MiniMax-M2.5')).toBe(MODEL_COLORS.minimax);
    expect(getModelColor('MiniMax-M2.5')).toBe('#34d399');
  });
});

describe('shortModelName', () => {
  it('shortens claude models', () => expect(shortModelName('claude-sonnet-3-5')).toBe('Sonnet 3.5'));
  it('shortens claude without minor version', () => expect(shortModelName('claude-opus-4')).toBe('Opus 4'));
  it('shortens gpt models', () => expect(shortModelName('gpt-4.1')).toBe('GPT 4.1'));
  it('truncates long unknown models', () => {
    const long = 'a-very-long-model-name-here';
    expect(shortModelName(long).length).toBeLessThanOrEqual(16);
  });
  it('returns short unknown models as-is', () => expect(shortModelName('short')).toBe('short'));
});
