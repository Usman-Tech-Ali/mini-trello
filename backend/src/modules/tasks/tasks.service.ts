import type {
  ActivityDto,
  ActivityTaskField,
  TaskDto,
  RestoreTaskInput,
  TaskFilters,
  UpdateTaskInput,
} from '@mini-trello/shared';
import { UNASSIGNED } from '@mini-trello/shared';
import type { createTaskSchema, moveTaskSchema } from '@mini-trello/shared';
import mongoose, { type ClientSession, type Types } from 'mongoose';
import type { z } from 'zod';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { type NewActivity, recordActivities } from '../activity/activity.service';
import { type BoardAccess, type TaskAccess, TASK_NOT_FOUND } from '../boards/board-access';
import { BoardModel } from '../boards/board.model';
import { CommentModel } from '../comments/comment.model';
import { findRevision, recordRevision } from '../history/history.service';
import { TaskRevisionModel } from '../history/task-revision.model';
import { createNotifications, type SentNotification } from '../notifications/notifications.service';
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

interface TaskChange {
  task: TaskDto;
  /** Activity recorded in the same transaction; broadcast only after it commits. */
  activities: ActivityDto[];
  /** Notifications created in the same transaction; delivered only after it commits. */
  notifications: SentNotification[];
}

/** Tells a new assignee (unless they assigned themselves; see createNotifications). */
function assignmentNotifications(
  access: BoardAccess,
  actorId: string,
  task: Pick<TaskShape, '_id' | 'title'>,
  assigneeId: string | null,
  session: mongoose.ClientSession,
): Promise<SentNotification[]> {
  if (!assigneeId) return Promise.resolve([]);
  return createNotifications(
    [
      {
        userId: assigneeId,
        type: 'task.assigned',
        actorId,
        workspaceId: access.workspaceId,
        boardId: access.boardId,
        taskId: task._id.toString(),
        taskTitle: task.title,
      },
    ],
    session,
  );
}

function activityFor(
  access: BoardAccess,
  actorId: string,
  task: Pick<TaskShape, '_id' | 'title'>,
): Pick<NewActivity, 'boardId' | 'workspaceId' | 'taskId' | 'actorId' | 'taskTitle'> {
  return {
    boardId: access.boardId,
    workspaceId: access.workspaceId,
    taskId: task._id.toString(),
    actorId,
    taskTitle: task.title,
  };
}

const sameDate = (a?: Date | null, b?: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Describes an edit as a `task.updated` entry (field list) and/or a `task.assigned` entry. */
function describeUpdate(
  access: BoardAccess,
  actorId: string,
  before: TaskShape,
  after: TaskShape,
): NewActivity[] {
  const base = activityFor(access, actorId, after);
  const fields: ActivityTaskField[] = [];
  if (before.title !== after.title) fields.push('title');
  if (before.description !== after.description) fields.push('description');
  if (before.priority !== after.priority) fields.push('priority');
  if (!sameDate(before.dueDate, after.dueDate)) fields.push('dueDate');

  const entries: NewActivity[] = [];
  if (fields.length > 0) entries.push({ ...base, action: 'task.updated', details: { fields } });
  const assigneeId = after.assigneeId?.toString() ?? null;
  if ((before.assigneeId?.toString() ?? null) !== assigneeId) {
    entries.push({ ...base, action: 'task.assigned', details: { assigneeId } });
  }
  return entries;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A board's tasks in display order, optionally filtered (filters combine with AND). Every query
 * is scoped to one board, so it starts from the { boardId, columnId, position } index and only
 * scans that board's tasks; a title regex can't use an index anyway, and a text index would not
 * match partial words ("log" in "login").
 */
export async function listTasks(boardId: string, filters: TaskFilters = {}): Promise<TaskDto[]> {
  const query: Record<string, unknown> = { boardId };
  if (filters.q) query.title = { $regex: escapeRegExp(filters.q), $options: 'i' };
  if (filters.assignee)
    query.assigneeId = filters.assignee === UNASSIGNED ? null : filters.assignee;
  if (filters.priority) query.priority = filters.priority;
  if (filters.column) query.columnId = filters.column;
  const tasks = await TaskModel.find(query).sort({ position: 1 }).lean();
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
): Promise<TaskChange & { created: boolean }> {
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

      const base = activityFor(access, creatorId, task);
      const entries: NewActivity[] = [{ ...base, action: 'task.created' }];
      if (input.assigneeId) {
        entries.push({
          ...base,
          action: 'task.assigned',
          details: { assigneeId: input.assigneeId },
        });
      }
      const activities = await recordActivities(entries, session);
      await recordRevision({ actorId: creatorId, action: 'created', after: task }, session);
      const notifications = await assignmentNotifications(
        access,
        creatorId,
        task,
        input.assigneeId,
        session,
      );
      return { task: toTaskDto(task), activities, notifications, created: true };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A retry of a request that already succeeded: return the original task, not a duplicate.
    const existing = await TaskModel.findOne({ creatorId, requestId: input.requestId }).lean();
    if (existing?.boardId.toString() !== access.boardId) throw error;
    return { task: toTaskDto(existing), activities: [], notifications: [], created: false };
  }
}

/** Applies a partial update only if `version` still matches; otherwise 409 VERSION_CONFLICT. */
export function updateTask(
  access: TaskAccess,
  actorId: string,
  input: UpdateTaskInput,
): Promise<TaskChange> {
  return applyUpdate(access, actorId, input, {});
}

async function applyUpdate(
  access: TaskAccess,
  actorId: string,
  input: UpdateTaskInput,
  options: { restoredFrom?: number },
): Promise<TaskChange> {
  const { version, dueDate, ...fields } = input;
  const changes: Record<string, unknown> = { ...fields };
  if (dueDate !== undefined) changes.dueDate = toDueDate(dueDate);

  const result = await mongoose.connection.transaction(async (session) => {
    if (fields.assigneeId !== undefined) {
      await assertAssignable(access.workspaceId, fields.assigneeId, session);
    }
    // The previous state is only needed to describe the change in the activity feed.
    const before = await TaskModel.findOne({ _id: access.taskId, version }).session(session).lean();
    if (!before) return null;
    const updated = await TaskModel.findOneAndUpdate(
      { _id: access.taskId, version },
      { $set: changes, $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).lean();
    if (!updated) return null;
    const activities = await recordActivities(
      describeUpdate(access, actorId, before, updated),
      session,
    );
    await recordRevision(
      {
        actorId,
        action: options.restoredFrom ? 'restored' : 'edited',
        before,
        after: updated,
        restoredFrom: options.restoredFrom,
      },
      session,
    );
    const newAssigneeId = updated.assigneeId?.toString() ?? null;
    const reassigned = newAssigneeId !== (before.assigneeId?.toString() ?? null);
    const notifications = reassigned
      ? await assignmentNotifications(access, actorId, updated, newAssigneeId, session)
      : [];
    return { task: toTaskDto(updated), activities, notifications };
  });
  if (!result) throw await conflictOrNotFound(access.taskId);
  return result;
}

/** Moves a task to `index` in `columnId`; version-checked like any other edit. */
export async function moveTask(
  access: TaskAccess,
  actorId: string,
  input: MoveTaskData,
): Promise<TaskChange> {
  const result = await mongoose.connection.transaction(async (session) => {
    const board = await BoardModel.findOne({ _id: access.boardId, 'columns._id': input.columnId })
      .select('columns')
      .session(session)
      .lean();
    if (!board) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid.', {
        columnId: ['Column not found on this board.'],
      });
    }

    const before = await TaskModel.findOne({ _id: access.taskId, version: input.version })
      .session(session)
      .lean();
    if (!before) return null;

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

    const updated = await TaskModel.findOneAndUpdate(
      { _id: access.taskId, version: input.version },
      { $set: { columnId: input.columnId, position }, $inc: { version: 1 } },
      { session, returnDocument: 'after' },
    ).lean();
    if (!updated) return null;

    // Reordering within a column is not worth a feed entry; changing column (status) is.
    const fromColumnId = before.columnId.toString();
    const entries: NewActivity[] = [];
    if (fromColumnId !== input.columnId) {
      const columnName = (id: string) =>
        board.columns.find((column) => column._id.toString() === id)?.name ?? 'a deleted column';
      entries.push({
        ...activityFor(access, actorId, updated),
        action: 'task.moved',
        details: { fromColumn: columnName(fromColumnId), toColumn: columnName(input.columnId) },
      });
    }
    const activities = await recordActivities(entries, session);
    await recordRevision({ actorId, action: 'moved', before, after: updated }, session);
    return { task: toTaskDto(updated), activities, notifications: [] };
  });
  if (!result) throw await conflictOrNotFound(access.taskId);
  return result;
}

/** Deletes the task and its comments; the activity log keeps a record of it. */
export async function deleteTask(access: TaskAccess, actorId: string): Promise<ActivityDto[]> {
  return mongoose.connection.transaction(async (session) => {
    const task = await TaskModel.findOneAndDelete({ _id: access.taskId }, { session }).lean();
    if (!task) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
    await CommentModel.deleteMany({ taskId: access.taskId }, { session });
    await TaskRevisionModel.deleteMany({ taskId: access.taskId }, { session });
    return recordActivities(
      [{ ...activityFor(access, actorId, task), action: 'task.deleted' }],
      session,
    );
  });
}

/**
 * Brings back an earlier version's content as a new version (history is never rewritten). Goes
 * through the same version-checked update as an edit, so restoring over someone else's newer
 * change is a 409, and activity, notifications and broadcasts work as for any edit. The status
 * (column) is not restored: moving a card is a workflow step, not content.
 */
export async function restoreTask(
  access: TaskAccess,
  actorId: string,
  { version, toVersion }: RestoreTaskInput,
): Promise<TaskChange> {
  const target = await mongoose.connection.transaction(async (session) => {
    const revision = await findRevision(access.taskId, toVersion, session);
    if (!revision) return null;
    // A former member can't be assigned again; restore the rest and leave it unassigned.
    const assigneeId =
      revision.snapshot.assigneeId &&
      (await MembershipModel.exists({
        workspaceId: access.workspaceId,
        userId: revision.snapshot.assigneeId,
      }).session(session))
        ? revision.snapshot.assigneeId
        : null;
    return { ...revision.snapshot, assigneeId };
  });
  if (!target) throw new AppError(404, 'NOT_FOUND', 'That version of the task is not available.');

  const current = await TaskModel.findById(access.taskId).lean();
  if (!current) throw new AppError(404, 'NOT_FOUND', TASK_NOT_FOUND);
  const changes: Omit<UpdateTaskInput, 'version'> = {};
  if (current.title !== target.title) changes.title = target.title;
  if (current.description !== target.description) changes.description = target.description;
  if (current.priority !== target.priority) changes.priority = target.priority;
  if ((current.assigneeId?.toString() ?? null) !== target.assigneeId) {
    changes.assigneeId = target.assigneeId;
  }
  const currentDue = current.dueDate ? current.dueDate.toISOString().slice(0, 10) : null;
  if (currentDue !== target.dueDate) changes.dueDate = target.dueDate;
  if (Object.keys(changes).length === 0) {
    if (current.version !== version) throw await conflictOrNotFound(access.taskId);
    throw new AppError(400, 'NOTHING_TO_RESTORE', 'The task already matches that version.');
  }
  return applyUpdate(access, actorId, { version, ...changes }, { restoredFrom: toVersion });
}
