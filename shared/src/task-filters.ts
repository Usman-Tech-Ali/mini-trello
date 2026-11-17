import { z } from 'zod';

import { objectIdSchema } from './common';
import { taskPrioritySchema, type TaskDto } from './tasks';

export const UNASSIGNED = 'unassigned';

/**
 * Board task filters, shared by `GET /api/boards/:boardId/tasks` and the board's URL
 * (`?q=&assignee=&priority=&column=`). Every filter is optional; set filters combine with AND.
 */
export const taskFiltersSchema = z.object({
  /** Case-insensitive match anywhere in the title. */
  q: z.string().trim().max(200, 'Search must be at most 200 characters').optional(),
  /** A member id, or "unassigned". */
  assignee: z.union([objectIdSchema, z.literal(UNASSIGNED)]).optional(),
  priority: taskPrioritySchema.optional(),
  /** Column (status) id. */
  column: objectIdSchema.optional(),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

export function hasActiveFilters(filters: TaskFilters): boolean {
  return [filters.q, filters.assignee, filters.priority, filters.column].some(Boolean);
}

/** The same rules as the API's query, for filtering tasks already loaded on the client. */
export function matchesTaskFilters(
  task: Pick<TaskDto, 'title' | 'assigneeId' | 'priority' | 'columnId'>,
  filters: TaskFilters,
): boolean {
  if (filters.q && !task.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
  if (filters.assignee) {
    const assignee = task.assigneeId ?? UNASSIGNED;
    if (assignee !== filters.assignee) return false;
  }
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.column && task.columnId !== filters.column) return false;
  return true;
}
