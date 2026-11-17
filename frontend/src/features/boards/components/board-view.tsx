'use client';

import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { BoardDto, MemberDto } from '@mini-trello/shared';
import { createBoardSchema, createColumnSchema } from '@mini-trello/shared';
import {
  EllipsisIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  SearchXIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { NameDialog } from '@/components/name-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityPanel } from '@/features/activity/components/activity-panel';
import { useCurrentUser } from '@/features/auth/hooks/use-session';
import { PresenceAvatars } from '@/features/realtime/components/presence-avatars';
import { useBoardChannel } from '@/features/realtime/hooks/use-board-channel';
import { typingUsers } from '@/features/realtime/lib/remote-updates';
import { TaskDialog } from '@/features/tasks/components/task-dialog';
import { useBoardTasks, useMoveTask } from '@/features/tasks/hooks/use-tasks';
import { groupTasksByColumn } from '@/features/tasks/lib/task-order';
import { useWorkspace, useWorkspaceMembers } from '@/features/workspaces/hooks/use-workspaces';
import { ApiError } from '@/lib/api/api-error';
import { initialOf, swatchFor } from '@/lib/colors';
import { cn } from '@/lib/utils';

import { useBoard, useCreateColumn, useDeleteBoard, useRenameBoard } from '../hooks/use-boards';
import { BoardColumn } from './board-column';

function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading board">
      <Skeleton className="h-9 w-64" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function BoardView({ boardId }: { boardId: string }) {
  const boardQuery = useBoard(boardId);

  if (boardQuery.isPending) return <BoardSkeleton />;
  if (boardQuery.isError) {
    return boardQuery.error instanceof ApiError && boardQuery.error.status === 404 ? (
      <EmptyState
        icon={SearchXIcon}
        title="Board not found"
        description="It may have been deleted, or you don't have access to it."
      />
    ) : (
      <ErrorState
        title="Could not load this board"
        message={boardQuery.error.message}
        onRetry={() => void boardQuery.refetch()}
        isRetrying={boardQuery.isFetching}
      />
    );
  }
  return <Board board={boardQuery.data} />;
}

function Board({ board }: { board: BoardDto }) {
  const router = useRouter();
  const workspace = useWorkspace(board.workspaceId);
  const membersQuery = useWorkspaceMembers(board.workspaceId);
  const tasksQuery = useBoardTasks(board.id);
  const moveTask = useMoveTask(board.id);
  const createColumn = useCreateColumn(board.id);
  const renameBoard = useRenameBoard(board.id);
  const deleteBoard = useDeleteBoard(board);

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<'rename' | 'add-column' | 'delete' | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const currentUser = useCurrentUser();
  const { onlineUserIds, typing } = useBoardChannel(board, {
    onTaskDeleted: (taskId) => {
      if (taskId !== openTaskId) return;
      setOpenTaskId(null);
      toast.info('This task was deleted by someone else.');
    },
  });

  const isAdmin = workspace.data?.role === 'admin';
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const membersById = useMemo(
    () => new Map<string, MemberDto>(members.map((m) => [m.userId, m])),
    [members],
  );
  const tasksByColumn = useMemo(
    () => groupTasksByColumn(board.columns, tasksQuery.data ?? []),
    [board.columns, tasksQuery.data],
  );
  const columnSizes = useMemo(
    () => new Map([...tasksByColumn].map(([id, tasks]) => [id, tasks.length])),
    [tasksByColumn],
  );
  const openTask = tasksQuery.data?.find((task) => task.id === openTaskId) ?? null;
  const taskIds = useMemo(
    () => new Set((tasksQuery.data ?? []).map((task) => task.id)),
    [tasksQuery.data],
  );
  // Names of other people currently editing each task (live typing indicators).
  const editorsByTask = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const taskId of typing.keys()) {
      const names = typingUsers(typing, taskId)
        .filter((userId) => userId !== currentUser.id)
        .flatMap((userId) => membersById.get(userId)?.name ?? []);
      if (names.length > 0) result.set(taskId, names);
    }
    return result;
  }, [typing, membersById, currentUser.id]);

  const onDragEnd = ({ draggableId, source, destination }: DropResult) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    const task = tasksQuery.data?.find((t) => t.id === draggableId);
    if (!task) return;

    setPendingTaskIds((ids) => new Set(ids).add(task.id));
    moveTask.mutate(
      { task, columnId: destination.droppableId, index: destination.index },
      {
        onError: (error) => {
          toast.error(
            error instanceof ApiError && error.code === 'VERSION_CONFLICT'
              ? 'Someone else changed this task, so the move was undone. The board has been refreshed.'
              : `Could not move the task: ${error.message}`,
          );
        },
        onSettled: () => {
          setPendingTaskIds((ids) => {
            const next = new Set(ids);
            next.delete(task.id);
            return next;
          });
        },
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg font-semibold text-white shadow-sm',
              swatchFor(board.id),
            )}
            aria-hidden="true"
          >
            {initialOf(board.name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl tracking-tight">{board.name}</h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {tasksQuery.data ? `${tasksQuery.data.length} tasks` : 'Loading tasks…'} ·{' '}
              {board.columns.length} columns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PresenceAvatars
            userIds={onlineUserIds}
            membersById={membersById}
            currentUserId={currentUser.id}
          />
          <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
            <HistoryIcon aria-hidden="true" />
            Activity
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog('add-column')}>
            <PlusIcon aria-hidden="true" />
            Add column
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Board options">
                <EllipsisIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDialog('rename')}>
                <PencilIcon aria-hidden="true" />
                Rename board
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog('delete')}>
                    <Trash2Icon aria-hidden="true" />
                    Delete board
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {tasksQuery.isError ? (
        <ErrorState
          title="Could not load tasks"
          message={tasksQuery.error.message}
          onRetry={() => void tasksQuery.refetch()}
          isRetrying={tasksQuery.isFetching}
        />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="-mx-4 flex min-h-0 flex-1 items-start gap-4 overflow-x-auto px-4 pb-4">
            {board.columns.map((column) => (
              <BoardColumn
                key={column.id}
                boardId={board.id}
                column={column}
                tasks={tasksByColumn.get(column.id) ?? []}
                membersById={membersById}
                pendingTaskIds={pendingTaskIds}
                editorsByTask={editorsByTask}
                onOpenTask={setOpenTaskId}
              />
            ))}
            <button
              type="button"
              onClick={() => setDialog('add-column')}
              className="flex h-24 w-72 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Add column
            </button>
          </div>
        </DragDropContext>
      )}

      <TaskDialog
        key={openTask?.id ?? 'closed'}
        task={openTask}
        board={board}
        members={members}
        columnSizes={columnSizes}
        editors={openTask ? (editorsByTask.get(openTask.id) ?? []) : []}
        onClose={() => setOpenTaskId(null)}
      />
      <ActivityPanel
        boardId={board.id}
        open={activityOpen}
        onOpenChange={setActivityOpen}
        membersById={membersById}
        onOpenTask={setOpenTaskId}
        existingTaskIds={taskIds}
      />
      <NameDialog
        open={dialog === 'add-column'}
        onOpenChange={(open) => setDialog(open ? 'add-column' : null)}
        title="Add column"
        label="Column name"
        placeholder="e.g. Review"
        submitLabel="Add column"
        schema={createColumnSchema.shape.name}
        onSubmit={(name) => createColumn.mutateAsync({ name, requestId: crypto.randomUUID() })}
      />
      <NameDialog
        open={dialog === 'rename'}
        onOpenChange={(open) => setDialog(open ? 'rename' : null)}
        title="Rename board"
        label="Board name"
        submitLabel="Save"
        initialValue={board.name}
        schema={createBoardSchema.shape.name}
        onSubmit={(name) => renameBoard.mutateAsync(name)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={`Delete “${board.name}”?`}
        description="The board and all of its tasks will be permanently deleted. This cannot be undone."
        confirmLabel="Delete board"
        isPending={deleteBoard.isPending}
        onConfirm={() =>
          deleteBoard.mutate(undefined, {
            onSuccess: () => {
              toast.success(`Deleted “${board.name}”`);
              router.replace(`/workspaces/${board.workspaceId}`);
            },
            onError: (error) => {
              setDialog(null);
              toast.error(error.message);
            },
          })
        }
      />
    </div>
  );
}
