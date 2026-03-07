import type { CombinedError } from 'urql';

export type FallbackSurface = 'source' | 'system';

export type FallbackReasonTag =
  | 'source-null'
  | 'system-null'
  | 'system-typename-mismatch'
  | 'network-error'
  | 'ambiguous-selector'
  | 'source-not-found'
  | 'internal-server-error';

export type FallbackMode = 'transient' | 'sticky';

const WHITELISTED_GRAPHQL_CODES: ReadonlySet<string> = new Set([
  'AMBIGUOUS_SELECTOR',
  'SOURCE_NOT_FOUND',
  'INTERNAL_SERVER_ERROR',
]);

const GRAPHQL_CODE_TO_REASON: Partial<Record<string, FallbackReasonTag>> = {
  AMBIGUOUS_SELECTOR: 'ambiguous-selector',
  SOURCE_NOT_FOUND: 'source-not-found',
  INTERNAL_SERVER_ERROR: 'internal-server-error',
};

export const extractGraphQLErrorCodes = (error: CombinedError | null | undefined): string[] => {
  if (!error) {
    return [];
  }

  return error.graphQLErrors
    .map((graphQLError) => graphQLError.extensions.code)
    .filter((code): code is string => typeof code === 'string');
};

export type ShouldFallbackToV1Input = {
  surface: FallbackSurface;
  namespaceMissing: boolean;
  error: CombinedError | null | undefined;
};

export const shouldFallbackToV1 = ({ namespaceMissing, error }: ShouldFallbackToV1Input): boolean => {
  if (namespaceMissing) {
    return true;
  }

  if (error?.networkError) {
    return true;
  }

  const graphQLErrorCodes = extractGraphQLErrorCodes(error);
  return graphQLErrorCodes.some((code) => WHITELISTED_GRAPHQL_CODES.has(code));
};

export const getFallbackReasonTag = ({
  surface,
  namespaceMissing,
  error,
}: ShouldFallbackToV1Input): FallbackReasonTag | null => {
  if (namespaceMissing) {
    return surface === 'system' ? 'system-null' : 'source-null';
  }

  if (error?.networkError) {
    return 'network-error';
  }

  const graphQLErrorCodes = extractGraphQLErrorCodes(error);
  for (const code of graphQLErrorCodes) {
    const tag = GRAPHQL_CODE_TO_REASON[code];
    if (tag) {
      return tag;
    }
  }

  return null;
};

export const getFallbackMode = (reasonTag: FallbackReasonTag): FallbackMode => {
  switch (reasonTag) {
    case 'network-error':
    case 'internal-server-error':
      return 'transient';
    case 'source-null':
    case 'system-null':
    case 'system-typename-mismatch':
    case 'ambiguous-selector':
    case 'source-not-found':
      return 'sticky';
  }
};
