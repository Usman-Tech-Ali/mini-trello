import { randomUUID } from 'node:crypto';

import type {
  BoardDto,
  BoardResponse,
  TaskDto,
  TaskResponse,
  WorkspaceDto,
  WorkspaceResponse,
} from '@mini-trello/shared';

import type { TestUser } from './http';

export async function createWorkspace(owner: TestUser, name = 'Team Space'): Promise<WorkspaceDto> {
  const res = await owner.client
    .post('/api/workspaces')
    .send({ name, requestId: randomUUID() })
    .expect(201);
  return (res.body as WorkspaceResponse).workspace;
}

export async function addMember(
  admin: TestUser,
  workspaceId: string,
  member: TestUser,
): Promise<void> {
  await admin.client
    .post(`/api/workspaces/${workspaceId}/members`)
    .send({ email: member.user.email })
    .expect(201);
}

export async function createBoard(
  user: TestUser,
  workspaceId: string,
  name = 'Roadmap',
): Promise<BoardDto> {
  const res = await user.client
    .post(`/api/workspaces/${workspaceId}/boards`)
    .send({ name, requestId: randomUUID() })
    .expect(201);
  return (res.body as BoardResponse).board;
}

export async function createTask(
  user: TestUser,
  boardId: string,
  columnId: string,
  fields: Record<string, unknown> = {},
): Promise<TaskDto> {
  const res = await user.client
    .post(`/api/boards/${boardId}/tasks`)
    .send({ title: 'A task', columnId, requestId: randomUUID(), ...fields })
    .expect(201);
  return (res.body as TaskResponse).task;
}
