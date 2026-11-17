import type {
  MarkAllReadResponse,
  NotificationListResponse,
  NotificationResponse,
  UnreadCountResponse,
} from '@mini-trello/shared';
import { notificationListQuerySchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getAuthUserId } from '../../lib/request-context';
import { parseIdParam, parseInput } from '../../lib/validate';
import { emitToUser } from '../../realtime/realtime-server';
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
  NOTIFICATION_NOT_FOUND,
} from './notifications.service';

export async function list(req: Request, res: Response<NotificationListResponse>): Promise<void> {
  const query = parseInput(notificationListQuerySchema, req.query);
  res.json(await listNotifications(getAuthUserId(req), query));
}

export async function unreadCount(req: Request, res: Response<UnreadCountResponse>): Promise<void> {
  res.json({ count: await countUnread(getAuthUserId(req)) });
}

export async function read(req: Request, res: Response<NotificationResponse>): Promise<void> {
  const userId = getAuthUserId(req);
  const notificationId = parseIdParam(req.params.notificationId, NOTIFICATION_NOT_FOUND);
  const notification = await markRead(userId, notificationId);
  // The user's other tabs update their badge.
  emitToUser(userId, 'notifications:changed');
  res.json({ notification });
}

export async function readAll(req: Request, res: Response<MarkAllReadResponse>): Promise<void> {
  const userId = getAuthUserId(req);
  const updated = await markAllRead(userId);
  if (updated > 0) emitToUser(userId, 'notifications:changed');
  res.json({ updated });
}
