import type { ActivityDto, ActivityTaskField } from '@mini-trello/shared';

const FIELD_LABELS: Record<ActivityTaskField, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  dueDate: 'due date',
};

/** "a", "a and b", "a, b and c". */
export function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`;
}

/**
 * What the actor did, written to follow their name: "moved “Fix login” from To Do to Done".
 * `nameOf` resolves user ids (e.g. the assignee) to display names.
 */
export function describeActivity(
  activity: ActivityDto,
  nameOf: (userId: string) => string,
): string {
  const task = `“${activity.taskTitle}”`;
  const { details } = activity;
  switch (activity.action) {
    case 'task.created':
      return `created ${task}`;
    case 'task.updated': {
      const fields = (details.fields ?? []).map((field) => FIELD_LABELS[field]);
      return fields.length > 0 ? `changed the ${listOf(fields)} of ${task}` : `edited ${task}`;
    }
    case 'task.moved':
      return `moved ${task} from ${details.fromColumn ?? '?'} to ${details.toColumn ?? '?'}`;
    case 'task.assigned':
      if (!details.assigneeId) return `unassigned ${task}`;
      if (details.assigneeId === activity.actorId) return `took ${task}`;
      return `assigned ${task} to ${nameOf(details.assigneeId)}`;
    case 'task.deleted':
      return `deleted ${task}`;
    case 'comment.created':
      return `commented on ${task}`;
  }
}
