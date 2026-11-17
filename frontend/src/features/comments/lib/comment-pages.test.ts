import type { CommentDto } from '@mini-trello/shared';
import { describe, expect, it } from 'vitest';

import { addComment, flattenComments, type CommentPages } from './comment-pages';

function comment(id: string): CommentDto {
  return {
    id,
    taskId: 't1',
    boardId: 'b1',
    authorId: 'u1',
    body: `comment ${id}`,
    mentionIds: [],
    createdAt: '2026-11-17T10:00:00.000Z',
  };
}

// Pages are fetched newest → oldest; each page is oldest → newest.
const thread: CommentPages = {
  pages: [
    { comments: [comment('c3'), comment('c4')], nextCursor: 'c3' },
    { comments: [comment('c1'), comment('c2')], nextCursor: null },
  ],
  pageParams: [undefined, 'c3'],
};

describe('comment pages', () => {
  it('flattens the loaded thread oldest first', () => {
    expect(flattenComments(thread).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(flattenComments(undefined)).toEqual([]);
  });

  it('appends a new comment to the newest page', () => {
    const next = addComment(thread, comment('c5'));
    expect(flattenComments(next).map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('adds a comment only once, and leaves an unloaded thread alone', () => {
    expect(addComment(thread, comment('c2'))).toBe(thread);
    expect(addComment(undefined, comment('c5'))).toBeUndefined();
  });
});
