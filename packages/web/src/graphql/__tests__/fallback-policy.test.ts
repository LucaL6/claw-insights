import type { CombinedError } from 'urql';
import { describe, expect, it } from 'vitest';

import { extractGraphQLErrorCodes, getFallbackMode, shouldFallbackToV1 } from '../fallback-policy';

function mockError(codes: string[] = [], withNetworkError = false): CombinedError {
  return {
    graphQLErrors: codes.map((code) => ({ message: code, extensions: { code } })),
    networkError: withNetworkError ? new Error('network down') : undefined,
  } as unknown as CombinedError;
}

describe('extractGraphQLErrorCodes', () => {
  it('extracts graphQL extension codes', () => {
    const error = mockError(['SOURCE_NOT_FOUND', 'INTERNAL_SERVER_ERROR']);
    expect(extractGraphQLErrorCodes(error)).toEqual(['SOURCE_NOT_FOUND', 'INTERNAL_SERVER_ERROR']);
  });

  it('returns empty list for missing error', () => {
    expect(extractGraphQLErrorCodes(undefined)).toEqual([]);
  });
});

describe('shouldFallbackToV1', () => {
  it('returns true for source namespace missing', () => {
    expect(shouldFallbackToV1({ surface: 'source', namespaceMissing: true, error: undefined })).toBe(true);
  });

  it('returns true for system namespace missing/union mismatch', () => {
    expect(shouldFallbackToV1({ surface: 'system', namespaceMissing: true, error: undefined })).toBe(true);
  });

  it('returns true on network error', () => {
    expect(shouldFallbackToV1({ surface: 'source', namespaceMissing: false, error: mockError([], true) })).toBe(true);
  });

  it('returns true for whitelisted GraphQL codes', () => {
    expect(
      shouldFallbackToV1({
        surface: 'source',
        namespaceMissing: false,
        error: mockError(['AMBIGUOUS_SELECTOR']),
      }),
    ).toBe(true);
    expect(
      shouldFallbackToV1({
        surface: 'source',
        namespaceMissing: false,
        error: mockError(['SOURCE_NOT_FOUND']),
      }),
    ).toBe(true);
    expect(
      shouldFallbackToV1({
        surface: 'source',
        namespaceMissing: false,
        error: mockError(['INTERNAL_SERVER_ERROR']),
      }),
    ).toBe(true);
  });

  it('returns false for non-whitelisted GraphQL codes', () => {
    expect(shouldFallbackToV1({ surface: 'source', namespaceMissing: false, error: mockError(['FORBIDDEN']) })).toBe(
      false,
    );
  });
});

describe('getFallbackMode', () => {
  it('returns transient mode for recoverable reasons', () => {
    expect(getFallbackMode('network-error')).toBe('transient');
    expect(getFallbackMode('internal-server-error')).toBe('transient');
  });

  it('returns sticky mode for selector and namespace issues', () => {
    expect(getFallbackMode('source-null')).toBe('sticky');
    expect(getFallbackMode('system-null')).toBe('sticky');
    expect(getFallbackMode('system-typename-mismatch')).toBe('sticky');
    expect(getFallbackMode('ambiguous-selector')).toBe('sticky');
    expect(getFallbackMode('source-not-found')).toBe('sticky');
  });
});
