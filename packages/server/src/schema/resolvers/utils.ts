import { GraphQLError } from 'graphql';

/**
 * Wraps an async resolver function with standardized error handling.
 * Catches errors and re-throws as formatted GraphQLError.
 */
export function safe<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[resolver]', message, err);
    throw new GraphQLError(message, {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });
}
