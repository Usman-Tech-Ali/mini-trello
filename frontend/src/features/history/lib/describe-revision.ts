import type { TaskHistoryField, TaskRevisionChange, TaskRevisionDto } from '@mini-trello/shared';

import { priorityConfig } from '@/features/tasks/lib/priority';
import { formatCalendarDate } from '@/lib/dates';

export const FIELD_LABELS: Record<TaskHistoryField, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  assigneeId: 'Assignee',
  dueDate: 'Due date',
  status: 'Status',
};

/** What the actor did, written to follow their name. */
export function describeRevision(revision: TaskRevisionDto): string {
  switch (revision.action) {
    case 'created':
      return 'created the task';
    case 'edited':
      return revision.changes.length > 0 ? 'edited' : 'saved without changes';
    case 'moved':
      return revision.changes.length > 0 ? 'moved the task' : 'reordered the task';
    case 'restored':
      return `restored version ${revision.restoredFrom ?? '?'}`;
  }
}

/** A field value for display; long text is shortened (the full text is in "View"). */
export function formatValue(
  field: TaskHistoryField,
  value: string | null,
  nameOf: (userId: string) => string,
): string {
  if (value === null || value === '') {
    if (field === 'assigneeId') return 'Unassigned';
    if (field === 'dueDate') return 'No due date';
    return 'Empty';
  }
  switch (field) {
    case 'assigneeId':
      return nameOf(value);
    case 'priority':
      return priorityConfig[value as keyof typeof priorityConfig].label;
    case 'dueDate':
      return formatCalendarDate(value);
    case 'title':
    case 'description':
    case 'status':
      return value.length > 80 ? `${value.slice(0, 79)}…` : value;
  }
}

export function describeChange(
  change: TaskRevisionChange,
  nameOf: (userId: string) => string,
): { label: string; from: string; to: string } {
  return {
    label: FIELD_LABELS[change.field],
    from: formatValue(change.field, change.from, nameOf),
    to: formatValue(change.field, change.to, nameOf),
  };
}
