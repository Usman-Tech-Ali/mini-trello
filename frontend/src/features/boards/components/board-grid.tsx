'use client';

import { createBoardSchema } from '@mini-trello/shared';
import { PlusIcon, SquareKanbanIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { NameDialog } from '@/components/name-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { swatchFor } from '@/lib/colors';
import { formatRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { useBoards, useCreateBoard } from '../hooks/use-boards';

export function BoardGrid({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const boardsQuery = useBoards(workspaceId);
  const createBoard = useCreateBoard(workspaceId);
  const [creating, setCreating] = useState(false);

  const create = async (name: string) => {
    const board = await createBoard.mutateAsync({ name, requestId: crypto.randomUUID() });
    toast.success(`Created “${board.name}”`);
    router.push(`/boards/${board.id}`);
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="boards-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="boards-heading" className="text-lg font-semibold">
          Boards
        </h2>
        {boardsQuery.data && boardsQuery.data.length > 0 && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" />
            New board
          </Button>
        )}
      </div>

      {boardsQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading boards">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : boardsQuery.isError ? (
        <ErrorState
          title="Could not load boards"
          message={boardsQuery.error.message}
          onRetry={() => void boardsQuery.refetch()}
          isRetrying={boardsQuery.isFetching}
        />
      ) : boardsQuery.data.length === 0 ? (
        <EmptyState
          icon={SquareKanbanIcon}
          title="No boards yet"
          description="Boards hold your columns and tasks. Create one to start planning."
          action={
            <Button onClick={() => setCreating(true)}>
              <PlusIcon aria-hidden="true" />
              Create a board
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {boardsQuery.data.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="group block overflow-hidden rounded-xl border bg-card shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {/* Miniature of the board's columns instead of a decorative banner. */}
                <div className="flex h-20 gap-1.5 border-b bg-muted/60 p-3" aria-hidden="true">
                  {board.columns.slice(0, 4).map((column, i) => (
                    <div
                      key={column.id}
                      className="flex flex-1 flex-col gap-1 rounded-md bg-background/80 p-1.5"
                    >
                      <span className="h-1 w-2/3 rounded-full bg-border" />
                      {Array.from({ length: 2 - (i % 2) }, (_, j) => (
                        <span key={j} className="h-2.5 rounded-sm border bg-card" />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="space-y-1 p-4">
                  <p className="flex items-center gap-2 truncate font-medium transition-colors group-hover:text-brand-text">
                    <span className={cn('size-2.5 shrink-0 rounded-full', swatchFor(board.id))} />
                    {board.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {board.columns.length} columns · updated {formatRelative(board.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New board"
        description="It starts with To do, In progress and Done columns."
        label="Board name"
        placeholder="e.g. Product launch"
        submitLabel="Create board"
        schema={createBoardSchema.shape.name}
        onSubmit={create}
      />
    </section>
  );
}
