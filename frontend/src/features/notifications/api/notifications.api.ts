import type {
  MarkAllReadResponse,
  NotificationDto,
  NotificationListResponse,
  NotificationResponse,
  UnreadCountResponse,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function listNotifications(
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<NotificationListResponse> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiRequest<NotificationListResponse>(`/api/notifications${query}`, { signal });
}

export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const { count } = await apiRequest<UnreadCountResponse>('/api/notifications/unread-count', {
    signal,
  });
  return count;
}

export async function markNotificationRead(id: string): Promise<NotificationDto> {
  const { notification } = await apiRequest<NotificationResponse>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
  return notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { updated } = await apiRequest<MarkAllReadResponse>('/api/notifications/read-all', {
    method: 'PATCH',
  });
  return updated;
}
