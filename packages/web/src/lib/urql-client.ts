import { createClient as createSSEClient } from 'graphql-sse';
import { cacheExchange, Client, fetchExchange, mapExchange,subscriptionExchange } from 'urql';

let authErrorFired = false;
let authErrorCallback: (() => void) | null = null;

/** Register a callback that fires once when any API request returns 401/403. */
export function setAuthErrorCallback(cb: (() => void) | null) {
  authErrorCallback = cb;
  authErrorFired = false;
}

function fireAuthError() {
  if (authErrorFired) {return;}
  authErrorFired = true;
  authErrorCallback?.();
}

/** Check if a CombinedError or GraphQL error indicates an auth failure. */
function isAuthError(
  error: { response?: { status?: number }; graphQLErrors?: Array<{ extensions?: { code?: string } }> } | undefined,
): boolean {
  if (!error) {return false;}
  const status = error.response?.status;
  if (status === 401 || status === 403) {return true;}
  return error.graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') ?? false;
}

const sseClient = createSSEClient({ url: '/graphql' });

export const client = new Client({
  url: '/graphql',
  preferGetMethod: false,
  exchanges: [
    cacheExchange,
    mapExchange({
      onResult(result) {
        if (isAuthError(result.error)) {
          fireAuthError();
        }
      },
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          unsubscribe: sseClient.subscribe(
            { query: operation.query ?? '', variables: operation.variables as Record<string, unknown> },
            {
              ...sink,
              error(err) {
                // graphql-sse surfaces 401/403 as errors with status in message
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
                  fireAuthError();
                }
                (sink as { error: (e: unknown) => void }).error(err);
              },
            } as Parameters<typeof sseClient.subscribe>[1],
          ),
        }),
      }),
    }),
  ],
});
