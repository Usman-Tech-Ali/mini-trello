import type { CommentDto, CommentListResponse } from '@mini-trello/shared';
import type { InfiniteData } from '@tanstack/react-query';

export type CommentPages = InfiniteData<CommentListResponse>;

/**
 * Adds a comment to the newest page (pages[0]) of a loaded thread. Our own post and the live
 * event can both deliver the same comment, so it is added only once. A thread that isn't loaded
 * is left alone; it will be fetched when opened.
 */
export function addComment(
  data: CommentPages | undefined,
  comment: CommentDto,
): CommentPages | undefined {
  const [newest, ...older] = data?.pages ?? [];
  if (!data || !newest) return data;
  if (data.pages.some((page) => page.comments.some((c) => c.id === comment.id))) return data;
  return { ...data, pages: [{ ...newest, comments: [...newest.comments, comment] }, ...older] };
}

/** The whole loaded thread, oldest first (pages are fetched newest → oldest). */
export function flattenComments(data: CommentPages | undefined): CommentDto[] {
  return [...(data?.pages ?? [])].reverse().flatMap((page) => page.comments);
}
