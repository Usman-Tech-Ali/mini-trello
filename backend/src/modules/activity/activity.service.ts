import type {
  ActivityAction,
  ActivityDetails,
  ActivityDto,
  ActivityListResponse,
} from '@mini-trello/shared';
import type { ActivityFilters, activityListQuerySchema } from '@mini-trello/shared';
import { type ClientSession, Types } from 'mongoose';
import type { z } from 'zod';

import { ActivityModel } from './activity.model';

type ListQuery = z.output<typeof activityListQuerySchema>;

interface ActivityShape {
  _id: Types.ObjectId;
  boardId: Types.ObjectId;
  taskId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: ActivityAction;
  taskTitle: string;
  details?: ActivityDetails | null;
  createdAt: Date;
}

export interface NewActivity {
  boardId: string;
  workspaceId: string;
  taskId: string;
  actorId: string;
  action: ActivityAction;
  taskTitle: string;
  details?: ActivityDetails;
}

export function toActivityDto(activity: ActivityShape): ActivityDto {
  return {
    id: activity._id.toString(),
    boardId: activity.boardId.toString(),
    taskId: activity.taskId.toString(),
    actorId: activity.actorId.toString(),
    action: activity.action,
    taskTitle: activity.taskTitle,
    details: activity.details ?? {},
    createdAt: activity.createdAt.toISOString(),
  };
}

/**
 * Records activity inside the caller's transaction, so an entry exists if and only if the change
 * it describes was committed.
 */
export async function recordActivities(
  entries: NewActivity[],
  session: ClientSession,
): Promise<ActivityDto[]> {
  if (entries.length === 0) return [];
  // `ordered` keeps insertion order, so the returned list matches what happened.
  const created = await ActivityModel.insertMany(entries, { session, ordered: true });
  return created.map((doc) => toActivityDto(doc));
}

/**
 * ObjectIds start with their creation time in seconds, so a time range becomes an `_id` range
 * and is served by the same { boardId, _id } index as paging, with no separate date index.
 */
function idAtTime(iso: string, roundUp: boolean): Types.ObjectId {
  const seconds = new Date(iso).getTime() / 1000;
  return Types.ObjectId.createFromTime(roundUp ? Math.ceil(seconds) : Math.floor(seconds));
}

export async function listActivity(
  boardId: string,
  { cursor, limit }: ListQuery,
  filters: ActivityFilters = {},
): Promise<ActivityListResponse> {
  const filter: Record<string, unknown> = { boardId };
  if (filters.actor) filter.actorId = filters.actor;
  if (filters.action) filter.action = filters.action;
  const idRange: Record<string, Types.ObjectId> = {};
  // `from` inclusive: the smallest id of that second. `to` exclusive: below the first id of the
  // second at (or after) `to`.
  if (filters.from) idRange.$gte = idAtTime(filters.from, false);
  if (filters.to) idRange.$lt = idAtTime(filters.to, true);
  if (cursor) {
    const cursorId = new Types.ObjectId(cursor);
    // Same-length hex strings compare in id (= time) order.
    if (!idRange.$lt || cursorId.toHexString() < idRange.$lt.toHexString()) idRange.$lt = cursorId;
  }
  if (Object.keys(idRange).length > 0) filter._id = idRange;
  // One extra row tells us whether another page exists, without a count query.
  const rows = await ActivityModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();
  const page = rows.slice(0, limit);
  return {
    activities: page.map((row) => toActivityDto(row)),
    nextCursor: rows.length > limit ? (page.at(-1)?._id.toString() ?? null) : null,
  };
}
