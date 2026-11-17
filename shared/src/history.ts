import { z } from 'zod';

import { objectIdSchema } from './common';
import type { TaskPriority } from './tasks';

export const taskRevisionActionSchema = z.enum(['created', 'edited', 'moved', 'restored']);
export type TaskRevisionAction = z.infer<typeof taskRevisionActionSchema>;

/** Fields tracked in a task's history ("status" is the column). */
export type TaskHistoryField =
  'title' | 'description' | 'priority' | 'assigneeId' | 'dueDate' | 'status';

/** The task as it was at one version. Column name is a snapshot, so it survives renames. */
export interface TaskSnapshot {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  columnId: string;
  columnName: string;
}

/** One field's change; `status` values are column names, `assigneeId` values are user ids. */
export interface TaskRevisionChange {
  field: TaskHistoryField;
  from: string | null;
  to: string | null;
}

export interface TaskRevisionDto {
  id: string;
  taskId: string;
  /** The task version this revision produced. */
  version: number;
  actorId: string;
  action: TaskRevisionAction;
  /** For `restored`: the version whose content was brought back. */
  restoredFrom: number | null;
  /** Empty for a reorder within the same column. */
  changes: TaskRevisionChange[];
  snapshot: TaskSnapshot;
  createdAt: string;
}

/** Newest first; `cursor` is the oldest revision id already loaded. */
export const taskHistoryQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface TaskHistoryResponse {
  revisions: TaskRevisionDto[];
  nextCursor: string | null;
}

/**
 * Brings back an earlier version's content (title, description, priority, assignee, due date).
 * `version` is the current version the user is looking at, checked like any other edit.
 */
export const restoreTaskSchema = z.object({
  version: z.number().int().positive(),
  toVersion: z.number().int().positive(),
});
export type RestoreTaskInput = z.infer<typeof restoreTaskSchema>;
