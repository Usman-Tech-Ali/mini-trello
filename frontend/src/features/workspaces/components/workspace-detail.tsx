'use client';

import { ArrowLeftIcon, SearchXIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/api-error';

import { useWorkspace } from '../hooks/use-workspaces';
import { MembersPanel } from './members-panel';

export function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const {
    data: workspace,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useWorkspace(workspaceId);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/workspaces">
          <ArrowLeftIcon aria-hidden="true" />
          All workspaces
        </Link>
      </Button>

      {isPending ? (
        <div className="space-y-4" aria-label="Loading workspace">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState
            icon={SearchXIcon}
            title="Workspace not found"
            description="It doesn’t exist, or you don’t have access to it."
          />
        ) : (
          <ErrorState
            title="Could not load this workspace"
            message={error.message}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
            <Badge variant={workspace.role === 'admin' ? 'default' : 'secondary'}>
              {workspace.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>
          <MembersPanel workspace={workspace} />
        </>
      )}
    </div>
  );
}
