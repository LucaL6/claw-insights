import { Client, cacheExchange, fetchExchange, subscriptionExchange } from 'urql';
import { createClient as createSSEClient } from 'graphql-sse';

const sseClient = createSSEClient({ url: '/graphql' });

export const client = new Client({
  url: '/graphql',
  preferGetMethod: false,
  exchanges: [
    cacheExchange,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          unsubscribe: sseClient.subscribe(
            { query: operation.query!, variables: operation.variables as Record<string, unknown> },
            sink as Parameters<typeof sseClient.subscribe>[1],
          ),
        }),
      }),
    }),
  ],
});
