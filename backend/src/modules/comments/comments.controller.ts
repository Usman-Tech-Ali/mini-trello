import type { CommentListResponse, CommentResponse } from '@mini-trello/shared';
import { commentListQuerySchema, createCommentSchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getAuthUserId, getOriginSocketId, getTaskAccess } from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { emitActivity, emitToBoard } from '../../realtime/realtime-server';
import { createComment, listComments } from './comments.service';

export async function listForTask(req: Request, res: Response<CommentListResponse>): Promise<void> {
  const query = parseInput(commentListQuerySchema, req.query);
  res.json(await listComments(getTaskAccess(req).taskId, query));
}

export async function create(req: Request, res: Response<CommentResponse>): Promise<void> {
  const input = parseInput(createCommentSchema, req.body);
  const access = getTaskAccess(req);
  const { comment, activity, created } = await createComment(access, getAuthUserId(req), input);
  // Only after the transaction committed; a deduplicated retry has nothing new to announce.
  if (created) {
    emitToBoard(access.boardId, getOriginSocketId(req), 'comment:created', {
      boardId: access.boardId,
      comment,
    });
  }
  if (activity) emitActivity([activity]);
  res.status(created ? 201 : 200).json({ comment });
}
