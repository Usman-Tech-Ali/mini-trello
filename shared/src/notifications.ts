import { z } from 'zod';

import { objectIdSchema } from './common';

export const notificationTypeSchema = z.enum([
  'task.assigned',
  /** The recipient was assigned before and no longer is (unassigned, reassigned or restored). */
  'task.unassigned',
  'comment.mentioned',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/** Newest first; `cursor` is the oldest notification id already loaded. */
export const notificationListQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.input<typeof notificationListQuerySchema>;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  /** Who caused it (the assigner or the comment author). */
  actorId: string;
  /** Snapshot of the actor's name, so it reads correctly even if they leave the workspace. */
  actorName: string;
  workspaceId: string;
  boardId: string;
  taskId: string;
  /** Snapshot of the task title when it happened. */
  taskTitle: string;
  /** For mentions: the start of the comment. */
  excerpt: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationResponse {
  notification: NotificationDto;
}

export interface MarkAllReadResponse {
  updated: number;
}
