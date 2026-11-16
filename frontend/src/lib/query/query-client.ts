import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/api-error';

const MAX_QUERY_RETRIES = 2;

/** Client errors (4xx) are deterministic, so retrying them only delays the error message. */
function isRetryable(error: Error): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.isNetworkError || error.status >= 500;
}

interface QueryClientOptions {
  /** Called whenever any request fails with 401, i.e. the session expired or was revoked. */
  onUnauthorized: (client: QueryClient) => void;
}

export function createQueryClient({ onUnauthorized }: QueryClientOptions): QueryClient {
  const handleError = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) onUnauthorized(client);
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        // Socket.IO events keep board data fresh, so aggressive background refetching isn't needed.
        staleTime: 30_000,
        retry: (failureCount, error) => isRetryable(error) && failureCount < MAX_QUERY_RETRIES,
      },
      mutations: {
        // Retries of writes are explicit (with the same requestId), never automatic.
        retry: false,
      },
    },
  });
  return client;
}
