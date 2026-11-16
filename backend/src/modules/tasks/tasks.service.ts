import type { TaskDto, UpdateTaskInput } from '@mini-trello/shared';
import type { createTaskSchema, moveTaskSchema } from '@mini-trello/shared';
import mongoose, { type ClientSession, type Types } from 'mongoose';
import type { z } from 'zod';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { type BoardAccess, type TaskAccess, TASK_NOT_FOUND } from '../boards/board-access';
import { BoardModel } from '../boards/board.model';
import { MembershipModel } from '../workspaces/membership.model';
import { evenlySpacedPositions, POSITION_STEP, positionForIndex } from '@mini-trello/shared';
import { TaskModel } from './task.model';

type CreateTaskData = z.output<typeof createTaskSchema>;
type MoveTaskData = z.output<typeof moveTaskSchema>;

const VERSION_CONFLICT_MESSAGE =
  'This task was changed by someone else. Review the latest version and try again.';

interface TaskShape {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  columnId: Types.ObjectId;
  title: string;
  description: string;
  priority: TaskDto['priority'];
  assigneeId?: Types.ObjectId | null;
  dueDate?: Date | null;
  creatorId: Types.ObjectId;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toTaskDto(task: TaskShape): TaskDto {
  return {
    id: task._id.toString(),
    boardId: task.boardId.toString(),
    columnId: task.columnId.toString(),
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeId: task.assigneeId?.toString() ?? null,
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    creatorId: task.creatorId.toString(),
    position: task.position,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Due dates are calendar dates; stored as UTC midnight so they don't shift with time zones. */
function toDueDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function assertColumnOnBoard(
  boardId: string,
  columnId: string,
  session: ClientSession,
): Promise<void> {
  const exists = await BoardModel.exists({ _id: boardId, 'columns._id': columnId }).session(
    session,
  );
  if (!exists) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
      columnId: ['Column not found on this board.'],
    });
  }
}

async function assertAssignable(
  workspaceId: string,
  assigneeId: string | null,
  session: ClientSession,
): Promise<void> {
  if (!assigneeId) return;
  const member = await MembershipModel.exists({ workspaceId, userId: assigneeId }).session(session);
  if (!member) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
      assigneeId: ['The assignee must be a member of this workspace.'],
    });
  }
}

async function conflictOrNotFound(taskId: string): Promise<AppError> {
  const exists = await TaskModel.exists({ _id: taskId });
  return exists
    ? new AppError(409, 'VERSION_CONFLICT', VERSION_CONFLICT_MESSAGE)
    : new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
}

export async function listTasks(boardId: string): Promise<TaskDto[]> {
  const tasks = await TaskModel.find({ boardId }).sort({ position: 1 }).lean();
  return tasks.map(toTaskDto);
}

export async function getTask(taskId: string): Promise<TaskDto> {
  const task = await TaskModel.findById(taskId).lean();
  if (!task) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
  return toTaskDto(task);
}

export async function createTask(
  access: BoardAccess,
  creatorId: string,
  input: CreateTaskData,
): Promise<{ task: TaskDto; created: boolean }> {
  try {
    return await mongoose.connection.transaction(async (session) => {
      await assertColumnOnBoard(access.boardId, input.columnId, session);
      await assertAssignable(access.workspaceId, input.assigneeId, session);

      const last = await TaskModel.findOne({ boardId: access.boardId, columnId: input.columnId })
        .sort({ position: -1 })
        .select('position')
        .session(session)
        .lean();

      const [task] = await TaskModel.create(
        [
          {
            boardId: access.boardId,
            workspaceId: access.workspaceId,
            columnId: input.columnId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            assigneeId: input.assigneeId,
            dueDate: toDueDate(input.dueDate),
            creatorId,
            position: (last?.position ?? 0) + POSITION_STEP,
            requestId: input.requestId,
          },
        ],
        { session },
      );
      if (!task) throw new Error('Task was not created');
      return { task: toTaskDto(task), created: true };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A retry of a request that already succeeded: return the original task, not a duplicate.
    const existing = await TaskModel.findOne({ creatorId, requestId: input.requestId }).lean();
    if (existing?.boardId.toString() !== access.boardId) throw error;
    return { task: toTaskDto(existing), created: false };
  }
}

/** Applies a partial update only if `version` still matches; otherwise 409 VERSION_CONFLICT. */
export async function updateTask(access: TaskAccess, input: UpdateTaskInput): Promise<TaskDto> {
  const { version, dueDate, ...fields } = input;
  const changes: Record<string, unknown> = { ...fields };
  if (dueDate !== undefined) changes.dueDate = toDueDate(dueDate);

  const updated = await mongoose.connection.transaction(async (session) => {
    if (fields.assigneeId !== undefined) {
      await assertAssignable(access.workspaceId, fields.assigneeId, session);
    }
    return TaskModel.findOneAndUpdate(
      { _id: access.taskId, version },
      { $set: changes, $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).lean();
  });
  if (!updated) throw await conflictOrNotFound(access.taskId);
  return toTaskDto(updated);
}

/** Moves a task to `index` in `columnId`; version-checked like any other edit. */
export async function moveTask(access: TaskAccess, input: MoveTaskData): Promise<TaskDto> {
  const updated = await mongoose.connection.transaction(async (session) => {
    await assertColumnOnBoard(access.boardId, input.columnId, session);

    const siblings = await TaskModel.find({
      boardId: access.boardId,
      columnId: input.columnId,
      _id: { $ne: access.taskId },
    })
      .sort({ position: 1 })
      .select('position')
      .session(session)
      .lean();

    let positions = siblings.map((sibling) => sibling.position);
    let position = positionForIndex(positions, input.index);
    if (position === null) {
      // Neighbours are too close together: renumber the column once, then place the task.
      positions = evenlySpacedPositions(siblings.length);
      await TaskModel.bulkWrite(
        siblings.map((sibling, i) => ({
          updateOne: { filter: { _id: sibling._id }, update: { $set: { position: positions[i] } } },
        })),
        { session },
      );
      position = positionForIndex(positions, input.index) ?? POSITION_STEP;
    }

    return TaskModel.findOneAndUpdate(
      { _id: access.taskId, version: input.version },
      { $set: { columnId: input.columnId, position }, $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).lean();
  });
  if (!updated) throw await conflictOrNotFound(access.taskId);
  return toTaskDto(updated);
}

export async function deleteTask(taskId: string): Promise<void> {
  const result = await TaskModel.deleteOne({ _id: taskId });
  if (result.deletedCount === 0) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
}
