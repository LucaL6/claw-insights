import { describe, expect, test } from 'vitest';
import { formatModel } from '../formatModel';

describe('formatModel', () => {
  test('claude opus-4-6 → Opus 4.6', () => {
    expect(formatModel('claude-opus-4-6')).toBe('Opus 4.6');
  });

  test('claude sonnet-4-5-20250514 → Sonnet 4.5', () => {
    expect(formatModel('claude-sonnet-4-5-20250514')).toBe('Sonnet 4.5');
  });

  test('claude haiku-3-5 → Haiku 3.5', () => {
    expect(formatModel('claude-haiku-3-5')).toBe('Haiku 3.5');
  });

  test('gpt-5.1-codex → GPT 5.1 Codex', () => {
    expect(formatModel('gpt-5.1-codex')).toBe('GPT 5.1 Codex');
  });

  test('provider prefix: anthropic/claude-opus-4-6 → Opus 4.6', () => {
    expect(formatModel('anthropic/claude-opus-4-6')).toBe('Opus 4.6');
  });

  test('unknown model passes through', () => {
    expect(formatModel('some-unknown-model')).toBe('some-unknown-model');
  });

  test('empty string returns empty', () => {
    expect(formatModel('')).toBe('');
  });
});
