'use client';

import type { ActivityDto, MemberDto } from '@mini-trello/shared';
import { HistoryIcon } from 'lucide-react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { formatRelative } from '@/lib/dates';

import { useBoardActivity } from '../hooks/use-board-activity';
import { describeActivity } from '../lib/describe-activity';

interface ActivityPanelProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membersById: Map<string, MemberDto>;
  /** Opens a task that still exists; entries for deleted tasks aren't clickable. */
  onOpenTask: (taskId: string) => void;
  existingTaskIds: ReadonlySet<string>;
}

export function ActivityPanel({
  boardId,
  open,
  onOpenChange,
  membersById,
  onOpenTask,
  existingTaskIds,
}: ActivityPanelProps) {
  const activityQuery = useBoardActivity(boardId, open);
  const activities = activityQuery.data?.pages.flatMap((page) => page.activities) ?? [];
  const nameOf = (userId: string) => membersById.get(userId)?.name ?? 'Former member';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>Everything that happened on this board, newest first.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {activityQuery.isPending ? (
            <div className="flex flex-col gap-4" aria-label="Loading activity">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : activityQuery.isError ? (
            <ErrorState
              title="Could not load activity"
              message={activityQuery.error.message}
              onRetry={() => void activityQuery.refetch()}
              isRetrying={activityQuery.isFetching}
            />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="No activity yet"
              description="Creating, editing, moving, assigning and commenting on tasks shows up here."
            />
          ) : (
            <>
              <ol className="flex flex-col gap-1" aria-live="polite">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    actorName={nameOf(activity.actorId)}
                    text={describeActivity(activity, nameOf)}
                    onOpen={
                      existingTaskIds.has(activity.taskId)
                        ? () => {
                            onOpenChange(false);
                            onOpenTask(activity.taskId);
                          }
                        : undefined
                    }
                  />
                ))}
              </ol>
              {activityQuery.hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => void activityQuery.fetchNextPage()}
                  disabled={activityQuery.isFetchingNextPage}
                >
                  {activityQuery.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ActivityItemProps {
  activity: ActivityDto;
  actorName: string;
  text: string;
  onOpen?: () => void;
}

function ActivityItem({ activity, actorName, text, onOpen }: ActivityItemProps) {
  const content = (
    <>
      <UserAvatar name={actorName} className="size-7" />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm">
          <span className="font-medium">{actorName}</span> {text}
        </p>
        {activity.details.excerpt && (
          <p className="mt-1 line-clamp-2 border-l-2 pl-2 text-sm text-muted-foreground">
            {activity.details.excerpt}
          </p>
        )}
        <time dateTime={activity.createdAt} className="text-xs text-muted-foreground">
          {formatRelative(activity.createdAt)}
        </time>
      </div>
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full gap-3 rounded-md p-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {content}
        </button>
      ) : (
        <div className="flex gap-3 p-2">{content}</div>
      )}
    </li>
  );
}
