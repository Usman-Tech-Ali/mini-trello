import type { NotificationDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { describeNotification, notificationHref } from './describe-notification';

const base: NotificationDto = {
  id: 'n1',
  type: 'task.assigned',
  actorId: 'u1',
  actorName: 'Sara',
  workspaceId: 'w1',
  boardId: 'b1',
  taskId: 't1',
  taskTitle: 'Fix login',
  excerpt: null,
  read: false,
  createdAt: '2026-11-17T10:00:00.000Z',
};

describe('describeNotification', () => {
  it('describes assignments and mentions', () => {
    expect(describeNotification(base)).toBe('assigned you “Fix login”');
    expect(describeNotification({ ...base, type: 'comment.mentioned' })).toBe(
      'mentioned you on “Fix login”',
    );
  });

  it('links to the board with the task open', () => {
    expect(notificationHref(base)).toBe('/boards/b1?task=t1');
  });
});
