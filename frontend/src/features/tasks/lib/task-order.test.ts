import type { ColumnDto, TaskDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { applyMove, groupTasksByColumn } from './task-order';

const columns: ColumnDto[] = [
  { id: 'todo', name: 'To do' },
  { id: 'done', name: 'Done' },
];

function task(id: string, columnId: string, position: number): TaskDto {
  return {
    id,
    boardId: 'board',
    columnId,
    title: id,
    description: '',
    priority: 'medium',
    assigneeId: null,
    dueDate: null,
    creatorId: 'user',
    position,
    version: 1,
    createdAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
  };
}

function titles(tasks: TaskDto[]) {
  const groups = groupTasksByColumn(columns, tasks);
  return columns.map((c) => (groups.get(c.id) ?? []).map((t) => t.id));
}

describe('groupTasksByColumn', () => {
  it('groups by column in position order, ignoring unknown columns', () => {
    const tasks = [task('b', 'todo', 2048), task('a', 'todo', 1024), task('x', 'gone', 1)];
    expect(titles(tasks)).toEqual([['a', 'b'], []]);
  });
});

describe('applyMove', () => {
  const tasks = [task('a', 'todo', 1024), task('b', 'todo', 2048), task('c', 'todo', 3072)];

  it('reorders within a column', () => {
    expect(titles(applyMove(tasks, 'c', 'todo', 0))).toEqual([['c', 'a', 'b'], []]);
    expect(titles(applyMove(tasks, 'a', 'todo', 2))).toEqual([['b', 'c', 'a'], []]);
    expect(titles(applyMove(tasks, 'a', 'todo', 1))).toEqual([['b', 'a', 'c'], []]);
  });

  it('moves across columns', () => {
    expect(titles(applyMove(tasks, 'b', 'done', 0))).toEqual([['a', 'c'], ['b']]);
  });

  it('does not mutate the input', () => {
    applyMove(tasks, 'a', 'done', 0);
    expect(tasks[0]?.columnId).toBe('todo');
  });
});
