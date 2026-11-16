import type { MemberDto, TaskDto } from '@mini-trello/shared';
import { AlignLeftIcon, CalendarIcon } from 'lucide-react';

import { UserAvatar } from '@/components/user-avatar';
import { dueStatus, formatDueDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

import { PriorityBadge } from './priority-badge';

const dueStyles = {
  overdue: 'bg-destructive/10 text-destructive',
  today: 'bg-warning/25 text-warning-foreground',
  upcoming: 'text-muted-foreground',
} as const;

interface TaskCardProps {
  task: TaskDto;
  assignee: MemberDto | undefined;
  isDragging?: boolean;
}

export function TaskCard({ task, assignee, isDragging = false }: TaskCardProps) {
  const status = task.dueDate ? dueStatus(task.dueDate) : null;
  return (
    <div
      className={cn(
        'group space-y-2.5 rounded-lg border bg-card p-3 text-left shadow-xs transition-[box-shadow,border-color]',
        'hover:border-primary/40 hover:shadow-sm',
        isDragging && 'rotate-1 border-primary/50 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        {assignee && (
          <span title={`Assigned to ${assignee.name}`}>
            <UserAvatar name={assignee.name} className="size-6" />
          </span>
        )}
      </div>
      <p className="text-sm leading-snug font-medium break-words">{task.title}</p>
      {(task.dueDate || task.description) && (
        <div className="flex items-center gap-2 text-xs">
          {task.dueDate && status && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium',
                dueStyles[status],
              )}
            >
              <CalendarIcon className="size-3" aria-hidden="true" />
              <span>
                {status === 'overdue' && <span className="sr-only">Overdue: </span>}
                {formatDueDate(task.dueDate)}
              </span>
            </span>
          )}
          {task.description && (
            <span className="text-muted-foreground" title="Has a description">
              <AlignLeftIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Has a description</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
