import type { MemberDto, TaskDto } from '@mini-trello/shared';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskCard } from './task-card';

const base: TaskDto = {
  id: 't1',
  boardId: 'b1',
  columnId: 'c1',
  title: 'Design onboarding',
  description: '',
  priority: 'high',
  assigneeId: null,
  dueDate: null,
  creatorId: 'u1',
  position: 1024,
  version: 1,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const ada: MemberDto = {
  userId: 'u2',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'member',
  joinedAt: '2026-11-01T00:00:00.000Z',
};

describe('TaskCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows title, priority and the assignee initials', () => {
    render(<TaskCard task={base} assignee={ada} />);
    expect(screen.getByText('Design onboarding')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByTitle('Assigned to Ada Lovelace')).toBeInTheDocument();
  });

  it('flags overdue tasks for screen readers', () => {
    render(<TaskCard task={{ ...base, dueDate: '2026-11-10' }} assignee={undefined} />);
    expect(screen.getByText(/Overdue:/)).toBeInTheDocument();
  });

  it('describes near due dates relatively', () => {
    render(<TaskCard task={{ ...base, dueDate: '2026-11-17' }} assignee={undefined} />);
    expect(screen.getByText('tomorrow')).toBeInTheDocument();
    expect(screen.queryByText(/Overdue:/)).not.toBeInTheDocument();
  });

  it('marks tasks that have a description', () => {
    render(<TaskCard task={{ ...base, description: 'Details' }} assignee={undefined} />);
    expect(screen.getByText('Has a description')).toBeInTheDocument();
  });
});
