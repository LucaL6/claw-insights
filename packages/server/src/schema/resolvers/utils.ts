import { GraphQLError } from 'graphql';

import { createChildLogger } from '../../logger.js';

const log = createChildLogger('resolvers');

/**
 * Wraps an async resolver function with standardized error handling.
 * Catches errors and re-throws as formatted GraphQLError.
 */
export function safe<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    log.error({ err }, message);
    throw new GraphQLError(message, {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  });
}
