import type { TaskRevisionDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { describeChange, describeRevision, formatValue } from './describe-revision';

const nameOf = (id: string) => (id === 'u1' ? 'Sara' : 'Former member');

function revision(overrides: Partial<TaskRevisionDto>): TaskRevisionDto {
  return {
    id: 'r1',
    taskId: 't1',
    version: 2,
    actorId: 'u1',
    action: 'edited',
    restoredFrom: null,
    changes: [],
    snapshot: {
      title: 'Fix login',
      description: '',
      priority: 'medium',
      assigneeId: null,
      dueDate: null,
      columnId: 'c1',
      columnName: 'To do',
    },
    createdAt: '2026-11-17T10:00:00.000Z',
    ...overrides,
  };
}

describe('describeRevision', () => {
  it('names each kind of revision', () => {
    expect(describeRevision(revision({ action: 'created' }))).toBe('created the task');
    expect(
      describeRevision(
        revision({ changes: [{ field: 'title', from: 'a', to: 'b' }], action: 'edited' }),
      ),
    ).toBe('edited');
    expect(describeRevision(revision({ action: 'moved' }))).toBe('reordered the task');
    expect(describeRevision(revision({ action: 'restored', restoredFrom: 3 }))).toBe(
      'restored version 3',
    );
  });
});

describe('formatValue', () => {
  it('formats each field for people, not as stored', () => {
    expect(formatValue('assigneeId', 'u1', nameOf)).toBe('Sara');
    expect(formatValue('assigneeId', null, nameOf)).toBe('Unassigned');
    expect(formatValue('priority', 'high', nameOf)).toBe('High');
    expect(formatValue('dueDate', null, nameOf)).toBe('No due date');
    expect(formatValue('description', '', nameOf)).toBe('Empty');
    expect(formatValue('title', 'x'.repeat(100), nameOf)).toHaveLength(80);
  });

  it('describes a change with a label and both values', () => {
    expect(describeChange({ field: 'status', from: 'To do', to: 'Done' }, nameOf)).toEqual({
      label: 'Status',
      from: 'To do',
      to: 'Done',
    });
  });
});
