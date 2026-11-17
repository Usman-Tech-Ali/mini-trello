'use client';

import type { NotificationDto } from '@mini-trello/shared';
import { useQueryClient } from '@tanstack/react-query';
import { BellIcon, CheckCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { formatRelative } from '@/lib/dates';
import { getSocket } from '@/lib/realtime/socket';
import { cn } from '@/lib/utils';

import { notificationKeys } from '../api/notifications.keys';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '../hooks/use-notifications';
import { describeNotification, notificationHref } from '../lib/describe-notification';

/** Live updates: new notifications refresh the badge and pop a toast; reads sync across tabs. */
function useNotificationEvents() {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    const onCreated = ({ notification }: { notification: NotificationDto }) => {
      refresh();
      toast(`${notification.actorName} ${describeNotification(notification)}`, {
        description: notification.excerpt ?? undefined,
        action: { label: 'Open', onClick: () => router.push(notificationHref(notification)) },
      });
    };
    socket.on('notification:created', onCreated);
    socket.on('notifications:changed', refresh);
    return () => {
      socket.off('notification:created', onCreated);
      socket.off('notifications:changed', refresh);
    };
  }, [queryClient, router]);
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount().data ?? 0;
  const markAllRead = useMarkAllRead();
  useNotificationEvents();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <BellIcon aria-hidden="true" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
              aria-hidden="true"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(24rem,calc(100vw-2rem))] flex-col p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-7"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheckIcon aria-hidden="true" />
              Mark all as read
            </Button>
          )}
        </div>
        {open && <NotificationList onNavigate={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function NotificationList({ onNavigate }: { onNavigate: () => void }) {
  const query = useNotifications(true);
  const markRead = useMarkRead();
  const notifications = query.data?.pages.flatMap((page) => page.notifications) ?? [];

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3 p-4" aria-label="Loading notifications">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="p-4">
        <ErrorState
          title="Could not load notifications"
          message={query.error.message}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      </div>
    );
  }
  if (notifications.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-balance text-muted-foreground">
        Nothing here yet. You&rsquo;ll see it when someone assigns you a task or @mentions you.
      </p>
    );
  }

  return (
    <div className="max-h-[min(28rem,70dvh)] overflow-y-auto overscroll-contain p-1">
      <ul className="flex flex-col">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <Link
              href={notificationHref(notification)}
              onClick={() => {
                if (!notification.read) markRead.mutate(notification.id);
                onNavigate();
              }}
              className={cn(
                'flex gap-3 rounded-md p-3 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                !notification.read && 'bg-accent/50',
              )}
            >
              <UserAvatar name={notification.actorName} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words">
                  <span className="font-medium">{notification.actorName}</span>{' '}
                  {describeNotification(notification)}
                </p>
                {notification.excerpt && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {notification.excerpt}
                  </p>
                )}
                <time dateTime={notification.createdAt} className="text-xs text-muted-foreground">
                  {formatRelative(notification.createdAt)}
                </time>
              </div>
              {!notification.read && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                  <span className="sr-only">Unread</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Show older'}
        </Button>
      )}
    </div>
  );
}
