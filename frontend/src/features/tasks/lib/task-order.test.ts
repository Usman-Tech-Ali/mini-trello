import type { ColumnDto, TaskDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { applyMove, groupTasksByColumn, toColumnIndex } from './task-order';

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

describe('toColumnIndex', () => {
  // Column a b c d e; only b and d match the filters.
  const column = ['a', 'b', 'c', 'd', 'e'].map((id, i) => task(id, 'todo', (i + 1) * 1024));
  const visible = [column[1], column[3]].filter((t): t is TaskDto => !!t);

  it('places a dropped task just before the visible card it was dropped above', () => {
    expect(toColumnIndex(column, visible, 'x', 0)).toBe(1); // before b
    expect(toColumnIndex(column, visible, 'x', 1)).toBe(3); // before d
  });

  it('places it just after the last visible card when dropped at the end', () => {
    expect(toColumnIndex(column, visible, 'x', 2)).toBe(4); // after d, before hidden e
  });

  it('ignores the dragged task itself when it comes from the same column', () => {
    // Dragging b below d: among a c d e, "after d" is index 3.
    expect(toColumnIndex(column, visible, 'b', 1)).toBe(3);
  });

  it('appends when no card in the column is visible', () => {
    expect(toColumnIndex(column, [], 'x', 0)).toBe(5);
  });
});
