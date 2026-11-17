'use client';

import type { MemberDto, TaskDto, TaskRevisionDto } from '@mini-trello/shared';
import { ArrowRightIcon, HistoryIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { ApiError } from '@/lib/api/api-error';
import { formatRelative } from '@/lib/dates';

import { useRestoreTask, useTaskHistory } from '../hooks/use-task-history';
import {
  describeChange,
  describeRevision,
  FIELD_LABELS,
  formatValue,
} from '../lib/describe-revision';

interface TaskHistoryProps {
  task: TaskDto;
  boardId: string;
  membersById: Map<string, MemberDto>;
  /** Restoring is blocked while the edit form has unsaved changes. */
  hasUnsavedChanges: boolean;
}

export function TaskHistory({ task, boardId, membersById, hasUnsavedChanges }: TaskHistoryProps) {
  const historyQuery = useTaskHistory(task, true);
  const restore = useRestoreTask(boardId);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<TaskRevisionDto | null>(null);
  const revisions = historyQuery.data?.pages.flatMap((page) => page.revisions) ?? [];
  const nameOf = (userId: string) => membersById.get(userId)?.name ?? 'Former member';

  const confirmRestore = () => {
    if (!restoring) return;
    restore.mutate(
      { task, toVersion: restoring.version },
      {
        onSuccess: () => toast.success(`Restored version ${restoring.version}`),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
            toast.error('Someone changed this task just now. Review the latest version first.');
          } else if (error instanceof ApiError && error.code === 'NOTHING_TO_RESTORE') {
            toast.info('The task already matches that version.');
          } else {
            toast.error(error.message);
          }
        },
        onSettled: () => setRestoring(null),
      },
    );
  };

  if (historyQuery.isPending) {
    return (
      <div className="flex flex-col gap-3 py-4" aria-label="Loading history">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (historyQuery.isError) {
    return (
      <ErrorState
        title="Could not load the history"
        message={historyQuery.error.message}
        onRetry={() => void historyQuery.refetch()}
        isRetrying={historyQuery.isFetching}
      />
    );
  }
  if (revisions.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <HistoryIcon className="size-4" aria-hidden="true" />
        No recorded changes yet. History is kept from this version on.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      {hasUnsavedChanges && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          Save or discard your edits on the Details tab before restoring a version.
        </p>
      )}
      <ol className="flex flex-col">
        {revisions.map((revision) => {
          const actor = nameOf(revision.actorId);
          const isCurrent = revision.version === task.version;
          const isOpen = expanded === revision.version;
          return (
            <li key={revision.id} className="flex gap-3 border-b py-3 last:border-b-0">
              <UserAvatar name={actor} className="size-7" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm">
                  <span className="font-medium">{actor}</span> {describeRevision(revision)}
                  <span className="text-muted-foreground">
                    {' '}
                    — version {revision.version}
                    {isCurrent ? ' (current)' : ''}
                  </span>
                </p>
                {revision.changes.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {revision.changes.map((change) => {
                      const { label, from, to } = describeChange(change, nameOf);
                      return (
                        <li key={change.field} className="flex flex-wrap items-center gap-x-1.5">
                          <span className="text-muted-foreground">{label}:</span>
                          <span className="break-words text-muted-foreground line-through">
                            {from}
                          </span>
                          <ArrowRightIcon
                            className="size-3.5 text-muted-foreground"
                            aria-label="changed to"
                          />
                          <span className="break-words">{to}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {isOpen && <Snapshot revision={revision} nameOf={nameOf} />}
                <div className="flex flex-wrap items-center gap-2">
                  <time dateTime={revision.createdAt} className="text-xs text-muted-foreground">
                    {formatRelative(revision.createdAt)}
                  </time>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : revision.version)}
                  >
                    {isOpen ? 'Hide version' : 'View version'}
                  </Button>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7"
                      disabled={hasUnsavedChanges || restore.isPending}
                      onClick={() => setRestoring(revision)}
                    >
                      <RotateCcwIcon aria-hidden="true" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {historyQuery.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void historyQuery.fetchNextPage()}
          disabled={historyQuery.isFetchingNextPage}
        >
          {historyQuery.isFetchingNextPage ? 'Loading…' : 'Show older versions'}
        </Button>
      )}

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Restore version ${restoring?.version ?? ''}?`}
        description="Its title, description, priority, assignee and due date become a new version. The current content stays in the history, and the task stays in its current column."
        confirmLabel="Restore version"
        onConfirm={confirmRestore}
        isPending={restore.isPending}
      />
    </div>
  );
}

function Snapshot({
  revision,
  nameOf,
}: {
  revision: TaskRevisionDto;
  nameOf: (userId: string) => string;
}) {
  const { snapshot } = revision;
  const rows = [
    ['title', snapshot.title],
    ['priority', snapshot.priority],
    ['assigneeId', snapshot.assigneeId],
    ['dueDate', snapshot.dueDate],
  ] as const;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-muted/50 p-3 text-sm">
      {rows.map(([field, value]) => (
        <div key={field} className="contents">
          <dt className="text-muted-foreground">{FIELD_LABELS[field]}</dt>
          <dd className="break-words">{formatValue(field, value, nameOf)}</dd>
        </div>
      ))}
      <dt className="text-muted-foreground">Status</dt>
      <dd>{snapshot.columnName}</dd>
      <dt className="text-muted-foreground">Description</dt>
      <dd className="break-words whitespace-pre-wrap">
        {snapshot.description || <span className="text-muted-foreground">Empty</span>}
      </dd>
    </dl>
  );
}
