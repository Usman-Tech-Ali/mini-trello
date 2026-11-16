'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { PageLoader } from '@/components/feedback/page-loader';

import { useSession } from '../hooks/use-session';

/** Renders children only for signed-in users; everyone else is sent to /login?next=<current path>. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError, error, refetch, isFetching } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, pathname, router]);

  if (isError) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState
            title="Could not load your session"
            message={error.message}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        </div>
      </main>
    );
  }
  if (isPending || user === null) return <PageLoader />;
  return children;
}

/** For /login and /register: signed-in users go straight to their workspaces. */
export function GuestGuard({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace('/workspaces');
  }, [user, router]);

  if (isPending || user) return <PageLoader />;
  return children;
}
