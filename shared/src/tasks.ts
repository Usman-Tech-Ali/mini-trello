import { z } from 'zod';

import { objectIdSchema, requestIdSchema } from './common';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters');

export const taskDescriptionSchema = z
  .string()
  .trim()
  .max(5000, 'Description must be at most 5000 characters');

/** Calendar date without time, e.g. "2026-11-30". */
export const taskDueDateSchema = z.iso.date('Enter a valid date');

const versionSchema = z.number().int().positive();

export const createTaskSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema.default(''),
  columnId: objectIdSchema,
  priority: taskPrioritySchema.default('medium'),
  assigneeId: objectIdSchema.nullable().default(null),
  dueDate: taskDueDateSchema.nullable().default(null),
  requestId: requestIdSchema,
});
export type CreateTaskInput = z.input<typeof createTaskSchema>;

/** Partial update guarded by optimistic concurrency: `version` must match the stored task. */
export const updateTaskSchema = z
  .object({
    version: versionSchema,
    title: taskTitleSchema.optional(),
    description: taskDescriptionSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: objectIdSchema.nullable().optional(),
    dueDate: taskDueDateSchema.nullable().optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== 'version'), {
    message: 'Nothing to update',
  });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Moves a task to `index` within `columnId` (index among the column's other tasks). */
export const moveTaskSchema = z.object({
  version: versionSchema,
  columnId: objectIdSchema,
  index: z.number().int().min(0),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export interface TaskDto {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  creatorId: string;
  /** Sort key within the column (ascending). */
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskResponse {
  task: TaskDto;
}

export interface TaskListResponse {
  tasks: TaskDto[];
}
