import type {
  TaskHistoryField,
  TaskHistoryResponse,
  TaskPriority,
  TaskRevisionAction,
  TaskRevisionChange,
  TaskRevisionDto,
  TaskSnapshot,
} from '@mini-trello/shared';
import type { taskHistoryQuerySchema } from '@mini-trello/shared';
import type { ClientSession, Types } from 'mongoose';
import type { z } from 'zod';

import { BoardModel } from '../boards/board.model';
import { TaskRevisionModel } from './task-revision.model';

type ListQuery = z.output<typeof taskHistoryQuerySchema>;

/** The task fields a revision needs, as stored. */
export interface TaskState {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  columnId: Types.ObjectId;
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId?: Types.ObjectId | null;
  dueDate?: Date | null;
  version: number;
}

interface RevisionShape {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  version: number;
  actorId: Types.ObjectId;
  action: TaskRevisionAction;
  restoredFrom?: number | null;
  changes?: { field: string; from?: string | null; to?: string | null }[];
  snapshot: Omit<TaskSnapshot, 'assigneeId' | 'columnId' | 'dueDate'> & {
    assigneeId?: Types.ObjectId | null;
    dueDate?: string | null;
    columnId: Types.ObjectId;
  };
  createdAt: Date;
}

function toRevisionDto(revision: RevisionShape): TaskRevisionDto {
  const { snapshot } = revision;
  return {
    id: revision._id.toString(),
    taskId: revision.taskId.toString(),
    version: revision.version,
    actorId: revision.actorId.toString(),
    action: revision.action,
    restoredFrom: revision.restoredFrom ?? null,
    changes: (revision.changes ?? []).map((change) => ({
      field: change.field as TaskHistoryField,
      from: change.from ?? null,
      to: change.to ?? null,
    })),
    snapshot: {
      title: snapshot.title,
      description: snapshot.description,
      priority: snapshot.priority,
      assigneeId: snapshot.assigneeId?.toString() ?? null,
      dueDate: snapshot.dueDate ?? null,
      columnId: snapshot.columnId.toString(),
      columnName: snapshot.columnName,
    },
    createdAt: revision.createdAt.toISOString(),
  };
}

const dueDateText = (date?: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function snapshotOf(task: TaskState, columnName: string): TaskSnapshot {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    assigneeId: task.assigneeId?.toString() ?? null,
    dueDate: dueDateText(task.dueDate),
    columnId: task.columnId.toString(),
    columnName,
  };
}

function diff(before: TaskSnapshot, after: TaskSnapshot): TaskRevisionChange[] {
  const changes: TaskRevisionChange[] = [];
  const fields = ['title', 'description', 'priority', 'assigneeId', 'dueDate'] as const;
  for (const field of fields) {
    if (before[field] !== after[field]) {
      changes.push({ field, from: before[field], to: after[field] });
    }
  }
  if (before.columnId !== after.columnId) {
    changes.push({ field: 'status', from: before.columnName, to: after.columnName });
  }
  return changes;
}

/**
 * Records the version `after` just produced, inside the caller's transaction (so history exists
 * if and only if the change was committed). `before` is omitted for a newly created task.
 */
export async function recordRevision(
  options: {
    actorId: string;
    action: TaskRevisionAction;
    before?: TaskState;
    after: TaskState;
    restoredFrom?: number;
  },
  session: ClientSession,
): Promise<void> {
  const { actorId, action, before, after, restoredFrom } = options;
  const board = await BoardModel.findById(after.boardId).select('columns').session(session).lean();
  const columnName = (id: Types.ObjectId) =>
    board?.columns.find((column) => column._id.equals(id))?.name ?? 'Deleted column';
  const afterSnapshot = snapshotOf(after, columnName(after.columnId));
  const changes = before
    ? diff(snapshotOf(before, columnName(before.columnId)), afterSnapshot)
    : [];
  await TaskRevisionModel.create(
    [
      {
        taskId: after._id,
        boardId: after.boardId,
        version: after.version,
        actorId,
        action,
        restoredFrom: restoredFrom ?? null,
        changes,
        snapshot: afterSnapshot,
      },
    ],
    { session },
  );
}

export async function listHistory(
  taskId: string,
  { cursor, limit }: ListQuery,
): Promise<TaskHistoryResponse> {
  const filter: Record<string, unknown> = { taskId };
  if (cursor) filter._id = { $lt: cursor };
  const rows = await TaskRevisionModel.find(filter)
    .sort({ version: -1 })
    .limit(limit + 1)
    .lean();
  const page = rows.slice(0, limit);
  return {
    revisions: page.map((row) => toRevisionDto(row)),
    nextCursor: rows.length > limit ? (page.at(-1)?._id.toString() ?? null) : null,
  };
}

export async function findRevision(
  taskId: string,
  version: number,
  session: ClientSession,
): Promise<TaskRevisionDto | null> {
  const row = await TaskRevisionModel.findOne({ taskId, version }).session(session).lean();
  return row ? toRevisionDto(row) : null;
}
