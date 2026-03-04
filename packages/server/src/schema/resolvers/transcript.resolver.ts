import { GraphQLError } from 'graphql';

import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import { readTranscript } from '../../sources/readers/transcript-reader.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:transcript');

export function transcriptResolvers(ctx: AppContext): Partial<Resolvers> {
  const sessionTranscript: QueryResolvers['sessionTranscript'] = async (_parent, args) => {
    const start = performance.now();
    const readCtx = createReadContext();
    const filePath = ctx.ports.transcript.getTranscriptPath(args.sessionKey, readCtx);
    if (!filePath) {
      log.debug({ sessionKey: args.sessionKey }, 'transcript not found');
      return null;
    }

    try {
      const result = await readTranscript(filePath, args.sessionKey, {
        limit: args.limit ?? undefined,
        offset: args.offset ?? undefined,
      });
      const ms = performance.now() - start;
      if (ms > 200) {
        log.debug({ ms: Math.round(ms), sessionKey: args.sessionKey }, 'slow resolve: sessionTranscript');
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('File too large')) {
        log.warn({ sessionKey: args.sessionKey }, 'transcript too large');
        throw new GraphQLError('Transcript file too large', {
          extensions: { code: 'TRANSCRIPT_TOO_LARGE' },
        });
      }
      log.error({ err, sessionKey: args.sessionKey }, 'failed to read transcript');
      throw new GraphQLError('Failed to read transcript', {
        extensions: { code: 'TRANSCRIPT_READ_ERROR' },
      });
    }
  };

  return { Query: { sessionTranscript } };
}
