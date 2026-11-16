import type { TaskListResponse, TaskResponse } from '@mini-trello/shared';
import { createTaskSchema, moveTaskSchema, updateTaskSchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getAuthUserId, getBoardAccess, getTaskAccess } from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { createTask, deleteTask, getTask, listTasks, moveTask, updateTask } from './tasks.service';

export async function listForBoard(req: Request, res: Response<TaskListResponse>): Promise<void> {
  res.json({ tasks: await listTasks(getBoardAccess(req).boardId) });
}

export async function create(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(createTaskSchema, req.body);
  const { task, created } = await createTask(getBoardAccess(req), getAuthUserId(req), input);
  res.status(created ? 201 : 200).json({ task });
}

export async function get(req: Request, res: Response<TaskResponse>): Promise<void> {
  res.json({ task: await getTask(getTaskAccess(req).taskId) });
}

export async function update(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(updateTaskSchema, req.body);
  res.json({ task: await updateTask(getTaskAccess(req), input) });
}

export async function move(req: Request, res: Response<TaskResponse>): Promise<void> {
  const input = parseInput(moveTaskSchema, req.body);
  res.json({ task: await moveTask(getTaskAccess(req), input) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteTask(getTaskAccess(req).taskId);
  res.status(204).end();
}
