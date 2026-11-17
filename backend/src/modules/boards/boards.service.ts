import type { BoardDto, ColumnDto, CreateBoardInput, CreateColumnInput } from '@mini-trello/shared';
import { MAX_COLUMNS_PER_BOARD } from '@mini-trello/shared';
import mongoose, { type Types } from 'mongoose';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { ActivityModel } from '../activity/activity.model';
import { CommentModel } from '../comments/comment.model';
import { NotificationModel } from '../notifications/notification.model';
import { TaskModel } from '../tasks/task.model';
import { BOARD_NOT_FOUND, COLUMN_NOT_FOUND } from './board-access';
import { BoardModel } from './board.model';

const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'];

interface BoardShape {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  columns: { _id: Types.ObjectId; name: string }[];
  createdAt: Date;
  updatedAt: Date;
}

function toColumnDto(column: { _id: Types.ObjectId; name: string }): ColumnDto {
  return { id: column._id.toString(), name: column.name };
}

function toBoardDto(board: BoardShape): BoardDto {
  return {
    id: board._id.toString(),
    workspaceId: board.workspaceId.toString(),
    name: board.name,
    columns: board.columns.map(toColumnDto),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export async function createBoard(
  workspaceId: string,
  userId: string,
  input: CreateBoardInput,
): Promise<{ board: BoardDto; created: boolean }> {
  try {
    const board = await BoardModel.create({
      workspaceId,
      name: input.name,
      createdBy: userId,
      requestId: input.requestId,
      columns: DEFAULT_COLUMNS.map((name) => ({ name })),
    });
    return { board: toBoardDto(board), created: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await BoardModel.findOne({ createdBy: userId, requestId: input.requestId });
    if (existing?.workspaceId.toString() !== workspaceId) throw error;
    return { board: toBoardDto(existing), created: false };
  }
}

export async function listBoards(workspaceId: string): Promise<BoardDto[]> {
  const boards = await BoardModel.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  return boards.map(toBoardDto);
}

export async function getBoard(boardId: string): Promise<BoardDto> {
  const board = await BoardModel.findById(boardId).lean();
  if (!board) throw new AppError(404, 'NOT_FOUND', BOARD_NOT_FOUND);
  return toBoardDto(board);
}

export async function renameBoard(boardId: string, name: string): Promise<BoardDto> {
  const board = await BoardModel.findByIdAndUpdate(
    boardId,
    { $set: { name } },
    { returnDocument: 'after' },
  ).lean();
  if (!board) throw new AppError(404, 'NOT_FOUND', BOARD_NOT_FOUND);
  return toBoardDto(board);
}

/** Deletes the board and all of its tasks atomically. */
export async function deleteBoard(boardId: string): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    await TaskModel.deleteMany({ boardId }, { session });
    await CommentModel.deleteMany({ boardId }, { session });
    await ActivityModel.deleteMany({ boardId }, { session });
    await NotificationModel.deleteMany({ boardId }, { session });
    const result = await BoardModel.deleteOne({ _id: boardId }, { session });
    if (result.deletedCount === 0) throw new AppError(404, 'NOT_FOUND', BOARD_NOT_FOUND);
  });
}

export async function createColumn(
  boardId: string,
  input: CreateColumnInput,
): Promise<{ column: ColumnDto; created: boolean }> {
  // One atomic update: skips the push if this requestId was already applied (retry) or the
  // board already has the maximum number of columns.
  const result = await BoardModel.updateOne(
    {
      _id: boardId,
      'columns.requestId': { $ne: input.requestId },
      [`columns.${MAX_COLUMNS_PER_BOARD - 1}`]: { $exists: false },
    },
    { $push: { columns: { name: input.name, requestId: input.requestId } } },
  );
  const board = await BoardModel.findById(boardId).select('columns').lean();
  if (!board) throw new AppError(404, 'NOT_FOUND', BOARD_NOT_FOUND);

  const column = board.columns.find((c) => c.requestId === input.requestId);
  if (!column) {
    throw new AppError(
      409,
      'CONFLICT',
      `A board can have at most ${MAX_COLUMNS_PER_BOARD} columns.`,
    );
  }
  return { column: toColumnDto(column), created: result.modifiedCount === 1 };
}

export async function renameColumn(
  boardId: string,
  columnId: string,
  name: string,
): Promise<ColumnDto> {
  const result = await BoardModel.updateOne(
    { _id: boardId, 'columns._id': columnId },
    { $set: { 'columns.$.name': name } },
  );
  if (result.matchedCount === 0) throw new AppError(404, 'NOT_FOUND', COLUMN_NOT_FOUND);
  return { id: columnId, name };
}

/** Only empty columns can be deleted, so tasks are never orphaned or deleted by surprise. */
export async function deleteColumn(boardId: string, columnId: string): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const board = await BoardModel.exists({ _id: boardId, 'columns._id': columnId }).session(
      session,
    );
    if (!board) throw new AppError(404, 'NOT_FOUND', COLUMN_NOT_FOUND);

    const taskCount = await TaskModel.countDocuments({ boardId, columnId }, { session });
    if (taskCount > 0) {
      throw new AppError(
        409,
        'COLUMN_NOT_EMPTY',
        'Move or delete the tasks in this column before deleting it.',
      );
    }
    await BoardModel.updateOne(
      { _id: boardId },
      { $pull: { columns: { _id: columnId } } },
      { session },
    );
  });
}
