import type { TaskDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import {
  applyTyping,
  describeEditors,
  pruneTyping,
  removeRemoteTask,
  TYPING_TTL_MS,
  typingUsers,
  upsertRemoteTask,
  type TypingState,
} from './remote-updates';

function task(id: string, version: number, title = id): TaskDto {
  return {
    id,
    boardId: 'b',
    columnId: 'c',
    title,
    description: '',
    priority: 'medium',
    assigneeId: null,
    dueDate: null,
    creatorId: 'u',
    position: 1024,
    version,
    createdAt: '2026-11-17T00:00:00.000Z',
    updatedAt: '2026-11-17T00:00:00.000Z',
  };
}

describe('upsertRemoteTask', () => {
  it('adds unknown tasks and applies newer versions', () => {
    const tasks = [task('a', 1)];
    expect(upsertRemoteTask(tasks, task('b', 1)).map((t) => t.id)).toEqual(['a', 'b']);
    expect(upsertRemoteTask(tasks, task('a', 2, 'new'))[0]?.title).toBe('new');
  });

  it('ignores stale or duplicate copies (late events after a reconnect)', () => {
    const tasks = [task('a', 3, 'current')];
    expect(upsertRemoteTask(tasks, task('a', 2, 'old'))[0]?.title).toBe('current');
    expect(upsertRemoteTask(tasks, task('a', 3, 'same'))[0]?.title).toBe('current');
  });

  it('removes deleted tasks', () => {
    expect(removeRemoteTask([task('a', 1), task('b', 1)], 'a').map((t) => t.id)).toEqual(['b']);
  });
});

describe('typing state', () => {
  it('tracks who is typing per task and clears on stop', () => {
    let state: TypingState = new Map();
    state = applyTyping(state, { taskId: 't1', userId: 'sara', isTyping: true }, 0);
    state = applyTyping(state, { taskId: 't1', userId: 'ali', isTyping: true }, 0);
    expect(typingUsers(state, 't1')).toEqual(['sara', 'ali']);

    state = applyTyping(state, { taskId: 't1', userId: 'sara', isTyping: false }, 0);
    expect(typingUsers(state, 't1')).toEqual(['ali']);
  });

  it('expires indicators whose stop event never arrived', () => {
    const state = applyTyping(new Map(), { taskId: 't1', userId: 'sara', isTyping: true }, 0);
    expect(pruneTyping(state, TYPING_TTL_MS - 1)).toBe(state);
    expect(typingUsers(pruneTyping(state, TYPING_TTL_MS + 1), 't1')).toEqual([]);
  });
});

describe('describeEditors', () => {
  it('reads naturally for one, two and many people', () => {
    expect(describeEditors([])).toBe('');
    expect(describeEditors(['Sara'])).toBe('Sara is editing');
    expect(describeEditors(['Sara', 'Ali'])).toBe('Sara and Ali are editing');
    expect(describeEditors(['Sara', 'Ali', 'Zoe'])).toBe('Sara and 2 others are editing');
  });
});
