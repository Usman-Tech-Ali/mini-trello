'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setSession } from '@/features/auth/hooks/use-session';
import { installClientErrorReporter } from '@/lib/dev/client-error-reporter';
import { createQueryClient } from '@/lib/query/query-client';

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; useState keeps it stable across re-renders.
  const [queryClient] = useState(() =>
    createQueryClient({
      // Any 401 means the session is gone: mark the user signed out; the auth guard redirects.
      onUnauthorized: (client) => {
        setSession(client, null);
      },
    }),
  );

  // Development only: send browser errors to the API test-session log.
  useEffect(() => installClientErrorReporter(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster closeButton />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
