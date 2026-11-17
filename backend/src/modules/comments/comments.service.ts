import type { ActivityDto, CommentDto, CommentListResponse } from '@mini-trello/shared';
import type { commentListQuerySchema, createCommentSchema } from '@mini-trello/shared';
import mongoose, { type Types } from 'mongoose';
import type { z } from 'zod';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { recordActivities } from '../activity/activity.service';
import { type TaskAccess, TASK_NOT_FOUND } from '../boards/board-access';
import { TaskModel } from '../tasks/task.model';
import { CommentModel } from './comment.model';

type CreateCommentData = z.output<typeof createCommentSchema>;
type ListQuery = z.output<typeof commentListQuerySchema>;

const EXCERPT_LENGTH = 120;

interface CommentShape {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  boardId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

export function toCommentDto(comment: CommentShape): CommentDto {
  return {
    id: comment._id.toString(),
    taskId: comment.taskId.toString(),
    boardId: comment.boardId.toString(),
    authorId: comment.authorId.toString(),
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}

function excerptOf(body: string): string {
  return body.length > EXCERPT_LENGTH ? `${body.slice(0, EXCERPT_LENGTH - 1)}…` : body;
}

/** Newest page first, each page oldest → newest, so the UI can prepend "earlier" pages. */
export async function listComments(
  taskId: string,
  { cursor, limit }: ListQuery,
): Promise<CommentListResponse> {
  const filter: Record<string, unknown> = { taskId };
  if (cursor) filter._id = { $lt: cursor };
  const rows = await CommentModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const page = rows.slice(0, limit);
  return {
    comments: page.reverse().map((row) => toCommentDto(row)),
    nextCursor: rows.length > limit ? (page[0]?._id.toString() ?? null) : null,
  };
}

export async function createComment(
  access: TaskAccess,
  authorId: string,
  input: CreateCommentData,
): Promise<{ comment: CommentDto; activity: ActivityDto | null; created: boolean }> {
  try {
    return await mongoose.connection.transaction(async (session) => {
      // Read in the transaction: a task deleted concurrently can't end up with an orphan comment.
      const task = await TaskModel.findById(access.taskId).select('title').session(session).lean();
      if (!task) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);

      const [comment] = await CommentModel.create(
        [
          {
            taskId: access.taskId,
            boardId: access.boardId,
            authorId,
            body: input.body,
            requestId: input.requestId,
          },
        ],
        { session },
      );
      if (!comment) throw new Error('Comment was not created');

      const [activity] = await recordActivities(
        [
          {
            boardId: access.boardId,
            workspaceId: access.workspaceId,
            taskId: access.taskId,
            actorId: authorId,
            action: 'comment.created',
            taskTitle: task.title,
            details: { excerpt: excerptOf(input.body) },
          },
        ],
        session,
      );
      return { comment: toCommentDto(comment), activity: activity ?? null, created: true };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A retry of a request that already succeeded: return the original comment.
    const existing = await CommentModel.findOne({ authorId, requestId: input.requestId }).lean();
    if (existing?.taskId.toString() !== access.taskId) throw error;
    return { comment: toCommentDto(existing), activity: null, created: false };
  }
}
