import { z } from 'zod';

import { objectIdSchema } from './common';

export const activityActionSchema = z.enum([
  'task.created',
  'task.updated',
  'task.moved',
  'task.assigned',
  'task.deleted',
  'comment.created',
]);
export type ActivityAction = z.infer<typeof activityActionSchema>;

/**
 * Feed filters; all optional and combined with AND. `from`/`to` are instants (the client sends
 * the start of the first and the day after the last local day), `from` inclusive, `to` exclusive.
 */
export const activityFiltersSchema = z
  .object({
    actor: objectIdSchema.optional(),
    action: activityActionSchema.optional(),
    from: z.iso.datetime({ offset: true, message: 'Enter a valid date' }).optional(),
    to: z.iso.datetime({ offset: true, message: 'Enter a valid date' }).optional(),
  })
  .refine((f) => !f.from || !f.to || new Date(f.from) < new Date(f.to), {
    message: 'The start date must be before the end date',
    path: ['to'],
  });
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

/** Newest first; `cursor` is the oldest activity id already loaded. */
export const activityListQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ActivityListQuery = z.input<typeof activityListQuerySchema>;

export function hasActivityFilters(filters: ActivityFilters): boolean {
  return [filters.actor, filters.action, filters.from, filters.to].some(Boolean);
}

/** The API's filter rules, for deciding whether a live entry belongs in a filtered feed. */
export function matchesActivityFilters(
  activity: Pick<ActivityDto, 'actorId' | 'action' | 'createdAt'>,
  filters: ActivityFilters,
): boolean {
  if (filters.actor && activity.actorId !== filters.actor) return false;
  if (filters.action && activity.action !== filters.action) return false;
  const at = new Date(activity.createdAt).getTime();
  if (filters.from && at < new Date(filters.from).getTime()) return false;
  if (filters.to && at >= new Date(filters.to).getTime()) return false;
  return true;
}

/** Editable task fields reported by `task.updated`. */
export type ActivityTaskField = 'title' | 'description' | 'priority' | 'dueDate';

/**
 * What changed. Names (task title, columns) are snapshots taken when the activity happened, so
 * the feed still reads correctly after a task is renamed or deleted or a column is removed.
 */
export interface ActivityDetails {
  fields?: ActivityTaskField[];
  fromColumn?: string;
  toColumn?: string;
  /** For `task.assigned`: the new assignee, or null when unassigned. */
  assigneeId?: string | null;
  /** For `comment.created`: the start of the comment. */
  excerpt?: string;
}

export interface ActivityDto {
  id: string;
  boardId: string;
  taskId: string;
  actorId: string;
  action: ActivityAction;
  taskTitle: string;
  details: ActivityDetails;
  createdAt: string;
}

export interface ActivityListResponse {
  /** Newest first. */
  activities: ActivityDto[];
  /** Pass as `cursor` to load the next (older) page; null when there is none. */
  nextCursor: string | null;
}
