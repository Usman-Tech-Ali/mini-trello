'use client';

import type { WorkspaceDto } from '@mini-trello/shared';
import { LayoutGridIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/hooks/use-session';
import { initialOf, swatchFor } from '@/lib/colors';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { useWorkspaces } from '../hooks/use-workspaces';
import { CreateWorkspaceDialog } from './create-workspace-dialog';

function WorkspaceCard({ workspace }: { workspace: WorkspaceDto }) {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex size-11 items-center justify-center rounded-xl text-lg font-semibold text-white shadow-sm',
            swatchFor(workspace.id),
          )}
          aria-hidden="true"
        >
          {initialOf(workspace.name)}
        </span>
        <Badge variant={workspace.role === 'admin' ? 'default' : 'secondary'}>
          {workspace.role === 'admin' ? 'Admin' : 'Member'}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold transition-colors group-hover:text-brand-text">
          {workspace.name}
        </p>
        <p className="text-sm text-muted-foreground">Created {formatDate(workspace.createdAt)}</p>
      </div>
    </Link>
  );
}

export function WorkspaceList() {
  const user = useCurrentUser();
  const { data: workspaces, isPending, isError, error, refetch, isFetching } = useWorkspaces();
  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <section className="flex flex-col gap-8" aria-labelledby="workspaces-heading">
      <div className="border-b pb-6">
        <p className="text-sm font-medium text-brand-text">Welcome back, {firstName}</p>
        <h1
          id="workspaces-heading"
          className="mt-1 font-display text-4xl tracking-tight sm:text-5xl"
        >
          Your workspaces
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Each workspace is a team space with its own boards and members.
        </p>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading workspaces">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load workspaces"
          message={error.message}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={LayoutGridIcon}
          title="No workspaces yet"
          description="Create a workspace for your team, or ask an admin to add you to theirs."
          action={
            <CreateWorkspaceDialog
              trigger={
                <Button>
                  <PlusIcon aria-hidden="true" />
                  Create a workspace
                </Button>
              }
            />
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <WorkspaceCard workspace={workspace} />
            </li>
          ))}
          <li>
            <CreateWorkspaceDialog
              trigger={
                <button
                  type="button"
                  className="flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <PlusIcon className="size-5" aria-hidden="true" />
                  New workspace
                </button>
              }
            />
          </li>
        </ul>
      )}
    </section>
  );
}
