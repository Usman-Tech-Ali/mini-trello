'use client';

import type { WorkspaceDto } from '@mini-trello/shared';
import { LayoutGridIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useWorkspaces } from '../hooks/use-workspaces';
import { CreateWorkspaceDialog } from './create-workspace-dialog';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function WorkspaceCard({ workspace }: { workspace: WorkspaceDto }) {
  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:border-primary/40 hover:shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="truncate">{workspace.name}</CardTitle>
            <Badge variant={workspace.role === 'admin' ? 'default' : 'secondary'}>
              {workspace.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>
          <CardDescription>
            Created {dateFormat.format(new Date(workspace.createdAt))}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

const newWorkspaceButton = (
  <Button>
    <PlusIcon aria-hidden="true" />
    New workspace
  </Button>
);

export function WorkspaceList() {
  const { data: workspaces, isPending, isError, error, refetch, isFetching } = useWorkspaces();

  return (
    <section className="flex flex-col gap-6" aria-labelledby="workspaces-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="workspaces-heading" className="text-2xl font-semibold tracking-tight">
            Workspaces
          </h1>
          <p className="text-sm text-muted-foreground">Teams you belong to.</p>
        </div>
        {workspaces && workspaces.length > 0 && (
          <CreateWorkspaceDialog trigger={newWorkspaceButton} />
        )}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading workspaces">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
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
          action={<CreateWorkspaceDialog trigger={newWorkspaceButton} />}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <WorkspaceCard workspace={workspace} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
