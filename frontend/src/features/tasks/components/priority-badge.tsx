import type { TaskPriority } from '@mini-trello/shared';

import { cn } from '@/lib/utils';

import { priorityConfig } from '../lib/priority';

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, icon: Icon, className } = priorityConfig[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold',
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
