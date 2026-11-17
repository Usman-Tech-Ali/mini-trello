import type { ActivityDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { addActivity, type ActivityPages } from './activity-pages';
import { describeActivity, listOf } from './describe-activity';

function activity(overrides: Partial<ActivityDto>): ActivityDto {
  return {
    id: 'a1',
    boardId: 'b1',
    taskId: 't1',
    actorId: 'u1',
    action: 'task.created',
    taskTitle: 'Fix login',
    details: {},
    createdAt: '2026-11-17T10:00:00.000Z',
    ...overrides,
  };
}

const names: Record<string, string> = { u1: 'Sara', u2: 'Ali' };
const nameOf = (id: string) => names[id] ?? 'Former member';

describe('describeActivity', () => {
  it.each([
    [{ action: 'task.created' }, 'created “Fix login”'],
    [
      { action: 'task.updated', details: { fields: ['title', 'priority', 'dueDate'] } },
      'changed the title, priority and due date of “Fix login”',
    ],
    [
      { action: 'task.moved', details: { fromColumn: 'To Do', toColumn: 'Done' } },
      'moved “Fix login” from To Do to Done',
    ],
    [{ action: 'task.assigned', details: { assigneeId: 'u2' } }, 'assigned “Fix login” to Ali'],
    [{ action: 'task.assigned', details: { assigneeId: 'u1' } }, 'took “Fix login”'],
    [{ action: 'task.assigned', details: { assigneeId: null } }, 'unassigned “Fix login”'],
    [{ action: 'task.deleted' }, 'deleted “Fix login”'],
    [{ action: 'comment.created', details: { excerpt: 'hi' } }, 'commented on “Fix login”'],
  ] as const)('%o → %s', (overrides, expected) => {
    expect(describeActivity(activity(overrides as Partial<ActivityDto>), nameOf)).toBe(expected);
  });

  it('names removed members generically', () => {
    const text = describeActivity(
      activity({ action: 'task.assigned', details: { assigneeId: 'gone' } }),
      nameOf,
    );
    expect(text).toBe('assigned “Fix login” to Former member');
  });
});

describe('listOf', () => {
  it('joins words naturally', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('addActivity', () => {
  const feed: ActivityPages = {
    pages: [
      { activities: [activity({ id: 'a2' })], nextCursor: 'a2' },
      { activities: [activity({ id: 'a1' })], nextCursor: null },
    ],
    pageParams: [undefined, 'a2'],
  };

  it('puts a new entry at the top of the newest page', () => {
    const next = addActivity(feed, activity({ id: 'a3' }));
    expect(next?.pages[0]?.activities.map((a) => a.id)).toEqual(['a3', 'a2']);
    expect(next?.pages[1]).toBe(feed.pages[1]);
  });

  it('ignores an entry it already has, and a feed that is not loaded', () => {
    expect(addActivity(feed, activity({ id: 'a1' }))).toBe(feed);
    expect(addActivity(undefined, activity({ id: 'a3' }))).toBeUndefined();
  });
});
