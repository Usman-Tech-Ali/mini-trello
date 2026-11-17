import type { TaskListResponse, TaskResponse } from '@mini-trello/shared';
import {
  createTaskSchema,
  moveTaskSchema,
  taskFiltersSchema,
  updateTaskSchema,
} from '@mini-trello/shared';
import type { Request, Response } from 'express';

import {
  getAuthUserId,
  getBoardAccess,
  getOriginSocketId,
  getTaskAccess,
} from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { emitActivity, emitNotifications, emitToBoard } from '../../realtime/realtime-server';
import { createTask, deleteTask, getTask, listTasks, moveTask, updateTask } from './tasks.service';

// Broadcasts happen only after the service call resolved, i.e. after the write committed.

export async function listForBoard(req: Request, res: Response<TaskListResponse>): Promise<void> {
  const filters = parseInput(taskFiltersSchema, req.query);
  res.json({ tasks: await listTasks(getBoardAccess(req).boardId, filters) });
}

export async function create(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(createTaskSchema, req.body);
  const { boardId } = getBoardAccess(req);
  const { task, activities, notifications, created } = await createTask(
    getBoardAccess(req),
    getAuthUserId(req),
    input,
  );
  // A deduplicated retry changed nothing, so there is nothing new to announce.
  if (created) emitToBoard(boardId, getOriginSocketId(req), 'task:created', { boardId, task });
  emitActivity(activities);
  emitNotifications(notifications);
  res.status(created ? 201 : 200).json({ task });
}

export async function get(req: Request, res: Response<TaskResponse>): Promise<void> {
  res.json({ task: await getTask(getTaskAccess(req).taskId) });
}

export async function update(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(updateTaskSchema, req.body);
  const access = getTaskAccess(req);
  const { task, activities, notifications } = await updateTask(access, getAuthUserId(req), input);
  emitToBoard(access.boardId, getOriginSocketId(req), 'task:updated', {
    boardId: access.boardId,
    task,
  });
  emitActivity(activities);
  emitNotifications(notifications);
  res.json({ task });
}

export async function move(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(moveTaskSchema, req.body);
  const access = getTaskAccess(req);
  const { task, activities } = await moveTask(access, getAuthUserId(req), input);
  emitToBoard(access.boardId, getOriginSocketId(req), 'task:updated', {
    boardId: access.boardId,
    task,
  });
  emitActivity(activities);
  res.json({ task });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const access = getTaskAccess(req);
  const { boardId, taskId } = access;
  const activities = await deleteTask(access, getAuthUserId(req));
  emitToBoard(boardId, getOriginSocketId(req), 'task:deleted', { boardId, taskId });
  emitActivity(activities);
  res.status(204).end();
}
