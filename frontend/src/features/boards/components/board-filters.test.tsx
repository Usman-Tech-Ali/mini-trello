import type { ColumnDto, MemberDto } from '@mini-trello/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardFilters } from './board-filters';

const members: MemberDto[] = [
  {
    userId: '507f1f77bcf86cd799439011',
    name: 'Sara',
    email: 'sara@example.com',
    role: 'admin',
    joinedAt: '2026-11-16T00:00:00.000Z',
  },
];
const columns: ColumnDto[] = [{ id: '507f1f77bcf86cd799439012', name: 'To do' }];

function setup(filters = {}) {
  const onChange = vi.fn();
  const onClear = vi.fn();
  render(
    <BoardFilters
      filters={filters}
      onChange={onChange}
      onClear={onClear}
      members={members}
      columns={columns}
      currentUserId={members[0]?.userId ?? ''}
      shownCount={2}
      totalCount={5}
    />,
  );
  return { onChange, onClear, search: screen.getByRole('searchbox', { name: /search tasks/i }) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('BoardFilters', () => {
  it('searches after a short pause, with trimmed text', async () => {
    const { onChange, search } = setup();
    fireEvent.change(search, { target: { value: '  login ' } });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(onChange).toHaveBeenCalledWith({ q: 'login' });
  });

  it('clears the search box with Escape', () => {
    const { search } = setup({ q: 'login' });
    expect(search).toHaveValue('login');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(search).toHaveValue('');
  });

  it('focuses search when "/" is pressed elsewhere on the page', () => {
    const { search } = setup();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(search).toHaveFocus();
  });

  it('shows the total when nothing is filtered', () => {
    setup();
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('shows how many tasks match and offers to clear active filters', () => {
    const { onClear } = setup({ priority: 'high' });
    expect(screen.getByText('2 of 5 tasks')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
