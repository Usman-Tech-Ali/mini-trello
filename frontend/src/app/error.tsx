'use client';

import { ErrorState } from '@/components/feedback/error-state';

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
