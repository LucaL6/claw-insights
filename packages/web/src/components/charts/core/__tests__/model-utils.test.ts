import { describe, it, expect } from 'vitest';
import { getModelColor, shortModelName, MODEL_COLORS } from '../model-utils';

describe('getModelColor', () => {
  it('returns sky for opus', () => expect(getModelColor('claude-opus-4')).toBe(MODEL_COLORS.opus));
  it('returns violet for sonnet', () => expect(getModelColor('claude-sonnet-3-5')).toBe(MODEL_COLORS.sonnet));
  it('returns emerald for haiku', () => expect(getModelColor('claude-haiku-3')).toBe(MODEL_COLORS.haiku));
  it('returns orange for gpt', () => expect(getModelColor('gpt-4o')).toBe(MODEL_COLORS.gpt));
  it('returns zinc fallback for unknown', () => expect(getModelColor('llama-70b')).toBe('#71717a'));
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
