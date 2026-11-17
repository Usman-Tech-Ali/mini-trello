import type { NotificationDto } from '@mini-trello/shared';

/** What happened, written to follow the actor's name: "assigned you “Fix login”". */
export function describeNotification(notification: NotificationDto): string {
  const task = `“${notification.taskTitle}”`;
  switch (notification.type) {
    case 'task.assigned':
      return `assigned you ${task}`;
    case 'task.unassigned':
      return `unassigned you from ${task}`;
    case 'comment.mentioned':
      return `mentioned you on ${task}`;
  }
}

/** Where a notification leads: the board, with the task open. */
export function notificationHref(notification: NotificationDto): string {
  return `/boards/${notification.boardId}?task=${notification.taskId}`;
}
