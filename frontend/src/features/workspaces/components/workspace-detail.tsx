'use client';

import { SearchXIcon } from 'lucide-react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardGrid } from '@/features/boards/components/board-grid';
import { ApiError } from '@/lib/api/api-error';
import { initialOf, swatchFor } from '@/lib/colors';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

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

  if (isPending) {
    return (
      <div className="space-y-6" aria-label="Loading workspace">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }
  if (isError) {
    return error instanceof ApiError && error.status === 404 ? (
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
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            'flex size-14 items-center justify-center rounded-2xl text-2xl font-semibold text-white shadow-sm',
            swatchFor(workspace.id),
          )}
          aria-hidden="true"
        >
          {initialOf(workspace.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {workspace.name}
            </h1>
            <Badge variant={workspace.role === 'admin' ? 'default' : 'secondary'}>
              {workspace.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Created {formatDate(workspace.createdAt)}</p>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <BoardGrid workspaceId={workspace.id} />
        <MembersPanel workspace={workspace} />
      </div>
    </div>
  );
}
