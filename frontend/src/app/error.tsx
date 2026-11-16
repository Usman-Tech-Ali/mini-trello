'use client';

import { useEffect } from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { reportClientError } from '@/lib/dev/client-error-reporter';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError('error-boundary', error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <ErrorState
          message="This page failed to load. Try again, or refresh the page."
          onRetry={reset}
        />
      </div>
    </main>
  );
}
