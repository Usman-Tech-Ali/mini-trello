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

/** Newest first; `cursor` is the oldest activity id already loaded. */
export const activityListQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ActivityListQuery = z.input<typeof activityListQuerySchema>;

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
