'use client';

import { Draggable, Droppable } from '@hello-pangea/dnd';
import type { ColumnDto, MemberDto, TaskDto } from '@mini-trello/shared';
import { createColumnSchema } from '@mini-trello/shared';
import { EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { NameDialog } from '@/components/name-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskCard } from '@/features/tasks/components/task-card';
import { TaskComposer } from '@/features/tasks/components/task-composer';
import { cn } from '@/lib/utils';

import { useDeleteColumn, useRenameColumn } from '../hooks/use-boards';

interface BoardColumnProps {
  boardId: string;
  column: ColumnDto;
  tasks: TaskDto[];
  membersById: Map<string, MemberDto>;
  pendingTaskIds: ReadonlySet<string>;
  onOpenTask: (taskId: string) => void;
}

export function BoardColumn({
  boardId,
  column,
  tasks,
  membersById,
  pendingTaskIds,
  onOpenTask,
}: BoardColumnProps) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameColumn = useRenameColumn(boardId);
  const deleteColumn = useDeleteColumn(boardId);

  const removeColumn = () => {
    deleteColumn.mutate(column.id, {
      onSuccess: () => {
        toast.success(`Deleted “${column.name}”`);
        setConfirmDelete(false);
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error(error.message);
      },
    });
  };

  return (
    <section
      aria-label={`${column.name} column`}
      className="flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-muted/60"
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="truncate">{column.name}</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${column.name} options`}
            >
              <EllipsisIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>
              <PencilIcon aria-hidden="true" />
              Rename column
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2Icon aria-hidden="true" />
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-1 transition-colors',
              snapshot.isDraggingOver && 'rounded-lg bg-accent',
            )}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task.id}
                draggableId={task.id}
                index={index}
                // A task with a move in flight has a version the server is about to bump.
                isDragDisabled={pendingTaskIds.has(task.id)}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    role="button"
                    aria-label={`Open task: ${task.title}`}
                    onClick={() => onOpenTask(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onOpenTask(task.id);
                    }}
                    className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <TaskCard
                      task={task}
                      assignee={task.assigneeId ? membersById.get(task.assigneeId) : undefined}
                      isDragging={dragSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                No tasks yet
              </p>
            )}
          </div>
        )}
      </Droppable>

      <div className="p-2">
        <TaskComposer boardId={boardId} columnId={column.id} />
      </div>

      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename column"
        label="Column name"
        submitLabel="Save"
        initialValue={column.name}
        schema={createColumnSchema.shape.name}
        onSubmit={(name) => renameColumn.mutateAsync({ columnId: column.id, name })}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${column.name}”?`}
        description={
          tasks.length > 0
            ? 'This column still has tasks. Move or delete them first — the column can only be deleted when it is empty.'
            : 'The column will be removed from this board.'
        }
        confirmLabel="Delete column"
        onConfirm={removeColumn}
        isPending={deleteColumn.isPending}
      />
    </section>
  );
}
