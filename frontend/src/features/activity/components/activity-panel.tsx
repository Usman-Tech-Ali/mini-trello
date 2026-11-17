'use client';

import type { ActivityAction, ActivityDto, MemberDto } from '@mini-trello/shared';
import { hasActivityFilters } from '@mini-trello/shared';
import { HistoryIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toActivityFilters, type ActivityFilterInput } from '../lib/activity-pages';
import { describeActivity } from '../lib/describe-activity';

const ANY = 'any';

const ACTION_LABELS: Record<ActivityAction, string> = {
  'task.created': 'Created',
  'task.updated': 'Edited',
  'task.moved': 'Moved',
  'task.assigned': 'Assigned',
  'task.deleted': 'Deleted',
  'comment.created': 'Commented',
};

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
  const [input, setInput] = useState<ActivityFilterInput>({});
  const badRange = Boolean(input.fromDate && input.toDate && input.fromDate > input.toDate);
  // An inverted range is reported, not sent; the other filters still apply.
  const filters = useMemo(
    () =>
      toActivityFilters(badRange ? { ...input, fromDate: undefined, toDate: undefined } : input),
    [input, badRange],
  );
  const filtered = hasActivityFilters(filters);
  const activityQuery = useBoardActivity(boardId, filters, open);
  const activities = activityQuery.data?.pages.flatMap((page) => page.activities) ?? [];
  const nameOf = (userId: string) => membersById.get(userId)?.name ?? 'Former member';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>Everything that happened on this board, newest first.</SheetDescription>
        </SheetHeader>

        <ActivityFilterBar
          input={input}
          onChange={(patch) => setInput((current) => ({ ...current, ...patch }))}
          onClear={() => setInput({})}
          members={[...membersById.values()]}
          rangeError={badRange ? 'The start date must be on or before the end date.' : undefined}
        />

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
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
          ) : activities.length === 0 && filtered ? (
            <EmptyState
              icon={HistoryIcon}
              title="No matching activity"
              description="Nothing on this board matches these filters."
              action={
                <Button variant="outline" size="sm" onClick={() => setInput({})}>
                  Clear filters
                </Button>
              }
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

interface ActivityFilterBarProps {
  input: ActivityFilterInput;
  onChange: (patch: Partial<ActivityFilterInput>) => void;
  onClear: () => void;
  members: MemberDto[];
  rangeError?: string;
}

function ActivityFilterBar({
  input,
  onChange,
  onClear,
  members,
  rangeError,
}: ActivityFilterBarProps) {
  const active = Boolean(input.actor ?? input.action ?? input.fromDate ?? input.toDate);
  const people = [...members].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div role="search" aria-label="Filter activity" className="grid gap-3 border-b p-4">
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={input.actor ?? ANY}
          onValueChange={(value) => onChange({ actor: value === ANY ? undefined : value })}
        >
          <SelectTrigger aria-label="Person" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Anyone</SelectItem>
            {people.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={input.action ?? ANY}
          onValueChange={(value) =>
            onChange({ action: value === ANY ? undefined : (value as ActivityAction) })
          }
        >
          <SelectTrigger aria-label="Action" size="sm" className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any action</SelectItem>
            {Object.entries(ACTION_LABELS).map(([action, label]) => (
              <SelectItem key={action} value={action}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor="activity-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="activity-from"
            type="date"
            className="h-8"
            value={input.fromDate ?? ''}
            max={input.toDate}
            onChange={(event) => onChange({ fromDate: event.target.value || undefined })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="activity-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="activity-to"
            type="date"
            className="h-8"
            value={input.toDate ?? ''}
            min={input.fromDate}
            aria-invalid={!!rangeError}
            aria-describedby={rangeError ? 'activity-range-error' : undefined}
            onChange={(event) => onChange({ toDate: event.target.value || undefined })}
          />
        </div>
      </div>
      {rangeError && (
        <p id="activity-range-error" role="alert" className="text-sm text-destructive">
          {rangeError}
        </p>
      )}
      {active && (
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={onClear}>
          <XIcon aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
