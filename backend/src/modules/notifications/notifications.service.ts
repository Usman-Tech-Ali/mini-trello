import type {
  NotificationDto,
  NotificationListResponse,
  NotificationType,
} from '@mini-trello/shared';
import type { notificationListQuerySchema } from '@mini-trello/shared';
import type { ClientSession, Types } from 'mongoose';
import type { z } from 'zod';

import { AppError } from '../../lib/app-error';
import { UserModel } from '../users/user.model';
import { NotificationModel } from './notification.model';

type ListQuery = z.output<typeof notificationListQuerySchema>;

export const NOTIFICATION_NOT_FOUND = 'Notification not found.';

interface NotificationShape {
  _id: Types.ObjectId;
  type: NotificationType;
  actorId: Types.ObjectId;
  actorName: string;
  workspaceId: Types.ObjectId;
  boardId: Types.ObjectId;
  taskId: Types.ObjectId;
  taskTitle: string;
  excerpt?: string | null;
  readAt?: Date | null;
  createdAt: Date;
}

/** A notification to create; `userId` is the recipient. */
export interface NewNotification {
  userId: string;
  type: NotificationType;
  actorId: string;
  workspaceId: string;
  boardId: string;
  taskId: string;
  taskTitle: string;
  excerpt?: string | null;
}

export interface SentNotification {
  userId: string;
  notification: NotificationDto;
}

export function toNotificationDto(notification: NotificationShape): NotificationDto {
  return {
    id: notification._id.toString(),
    type: notification.type,
    actorId: notification.actorId.toString(),
    actorName: notification.actorName,
    workspaceId: notification.workspaceId.toString(),
    boardId: notification.boardId.toString(),
    taskId: notification.taskId.toString(),
    taskTitle: notification.taskTitle,
    excerpt: notification.excerpt ?? null,
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  };
}

/**
 * Creates notifications inside the caller's transaction, so they exist only if the assignment or
 * comment that caused them was committed. Nobody is notified about their own action.
 */
export async function createNotifications(
  entries: NewNotification[],
  session: ClientSession,
): Promise<SentNotification[]> {
  const wanted = entries.filter((entry) => entry.userId !== entry.actorId);
  if (wanted.length === 0) return [];
  const actorIds = [...new Set(wanted.map((entry) => entry.actorId))];
  const actors = await UserModel.find({ _id: { $in: actorIds } })
    .select('name')
    .session(session)
    .lean();
  const nameOf = new Map(actors.map((actor) => [actor._id.toString(), actor.name]));
  const created = await NotificationModel.insertMany(
    wanted.map((entry) => ({ ...entry, actorName: nameOf.get(entry.actorId) ?? 'Someone' })),
    { session, ordered: true },
  );
  return created.map((doc) => ({
    userId: doc.userId.toString(),
    notification: toNotificationDto(doc),
  }));
}

export function countUnread(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ userId, readAt: null });
}

export async function listNotifications(
  userId: string,
  { cursor, limit }: ListQuery,
): Promise<NotificationListResponse> {
  const filter: Record<string, unknown> = { userId };
  if (cursor) filter._id = { $lt: cursor };
  const [rows, unreadCount] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean(),
    countUnread(userId),
  ]);
  const page = rows.slice(0, limit);
  return {
    notifications: page.map((row) => toNotificationDto(row)),
    nextCursor: rows.length > limit ? (page.at(-1)?._id.toString() ?? null) : null,
    unreadCount,
  };
}

/** Only the recipient can mark it; anyone else gets 404, as if it didn't exist. */
export async function markRead(userId: string, notificationId: string): Promise<NotificationDto> {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, userId },
    // Keep the first read time if it was already read (idempotent).
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
    { returnDocument: 'after', updatePipeline: true },
  ).lean();
  if (!notification) throw new AppError(404, 'NOT_FOUND', NOTIFICATION_NOT_FOUND);
  return toNotificationDto(notification);
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await NotificationModel.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
  return result.modifiedCount;
}
