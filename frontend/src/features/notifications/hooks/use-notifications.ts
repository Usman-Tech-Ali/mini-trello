import type { NotificationDto, NotificationListResponse } from '@mini-trello/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications.api';
import { notificationKeys } from '../api/notifications.keys';

type NotificationPages = InfiniteData<NotificationListResponse>;

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: ({ signal }) => getUnreadCount(signal),
  });
}

/** The inbox, newest first; only fetched while the panel is open. */
export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam, signal }) => listNotifications(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

/** Applies `change` to every loaded notification (optimistic read state). */
function updateLoaded(
  data: NotificationPages | undefined,
  change: (notification: NotificationDto) => NotificationDto,
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, notifications: page.notifications.map(change) })),
  };
}

/** Optimistic: the item and badge update at once; on failure the server's state is reloaded. */
function useReadMutation<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  applies: (notification: NotificationDto, variables: V) => boolean,
  /** The unread count afterwards, given the count before and how many loaded items became read. */
  countAfter: (count: number, newlyRead: number) => number,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      let newlyRead = 0;
      queryClient.setQueryData<NotificationPages>(notificationKeys.list(), (data) =>
        updateLoaded(data, (notification) => {
          if (notification.read || !applies(notification, variables)) return notification;
          newlyRead += 1;
          return { ...notification, read: true };
        }),
      );
      queryClient.setQueryData<number>(notificationKeys.unreadCount(), (count) =>
        count === undefined ? count : countAfter(count, newlyRead),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkRead() {
  return useReadMutation(
    (id: string) => markNotificationRead(id),
    (notification, id) => notification.id === id,
    (count, newlyRead) => Math.max(0, count - newlyRead),
  );
}

export function useMarkAllRead() {
  return useReadMutation<void>(
    () => markAllNotificationsRead(),
    () => true,
    // Includes unread notifications that aren't loaded yet.
    () => 0,
  );
}
