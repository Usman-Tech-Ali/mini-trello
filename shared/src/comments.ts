import { z } from 'zod';

import { objectIdSchema, requestIdSchema } from './common';

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Write something first')
  .max(2000, 'Comment must be at most 2000 characters');

export const createCommentSchema = z.object({
  body: commentBodySchema,
  requestId: requestIdSchema,
});
export type CreateCommentInput = z.input<typeof createCommentSchema>;

/** Newest page first; `cursor` is the oldest comment id already loaded ("load earlier"). */
export const commentListQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type CommentListQuery = z.input<typeof commentListQuerySchema>;

export interface CommentDto {
  id: string;
  taskId: string;
  boardId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface CommentResponse {
  comment: CommentDto;
}

export interface CommentListResponse {
  /** Oldest first within the page. */
  comments: CommentDto[];
  /** Pass as `cursor` to load the previous (older) page; null when there is none. */
  nextCursor: string | null;
}
