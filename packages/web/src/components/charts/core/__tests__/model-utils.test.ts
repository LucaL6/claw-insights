import { describe, expect, it } from 'vitest';

import { getModelColor, MODEL_COLORS, shortModelName } from '../model-utils';

describe('getModelColor', () => {
  it('returns sky-400 for opus-4-6', () => expect(getModelColor('claude-opus-4-6')).toBe('#38bdf8'));
  it('returns sky-300 for opus-4-5', () => expect(getModelColor('claude-opus-4-5')).toBe('#7dd3fc'));
  it('returns sky fallback for generic opus', () => expect(getModelColor('claude-opus-4')).toBe(MODEL_COLORS.opus));
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

  it('returns teal for minimax', () => {
    expect(getModelColor('MiniMax-M2.5')).toBe(MODEL_COLORS.minimax);
    expect(getModelColor('MiniMax-M2.5')).toBe('#2dd4bf');
  });
});

describe('shortModelName', () => {
  it('shortens claude models', () => expect(shortModelName('claude-sonnet-3-5')).toBe('Sonnet 3.5'));
  it('shortens claude without minor version', () => expect(shortModelName('claude-opus-4')).toBe('Opus 4'));
  it('shortens gpt models', () => expect(shortModelName('gpt-4.1')).toBe('GPT 4.1'));
  it('uses Codex naming for codex models', () => {
    expect(shortModelName('gpt-5.3-codex')).toBe('Codex 5.3');
    expect(shortModelName('gpt-5.3-codex-spark')).toBe('Codex 5.3 Spark');
  });
  it('supports provider-prefixed codex ids', () => {
    expect(shortModelName('openai-codex/gpt-5.3-codex')).toBe('Codex 5.3');
    expect(shortModelName('openai-codex/gpt-5.3-codex-spark')).toBe('Codex 5.3 Spark');
  });
  it('handles GPT variant suffixes', () => expect(shortModelName('gpt-4o-mini')).toBe('GPT 4o Mini'));
  it('truncates long unknown models', () => {
    const long = 'a-very-long-model-name-here';
    expect(shortModelName(long).length).toBeLessThanOrEqual(16);
  });
  it('returns short unknown models as-is', () => expect(shortModelName('short')).toBe('short'));
});
