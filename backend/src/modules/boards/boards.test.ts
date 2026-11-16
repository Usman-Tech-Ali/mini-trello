import { randomUUID } from 'node:crypto';

import type {
  ApiErrorResponse,
  BoardDto,
  BoardListResponse,
  BoardResponse,
  ColumnResponse,
  WorkspaceDto,
} from '@mini-trello/shared';
import { MAX_COLUMNS_PER_BOARD } from '@mini-trello/shared';
import type request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { TaskModel } from '../tasks/task.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspace: WorkspaceDto;

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
  admin = await registerUser(app, 'Admin');
  member = await registerUser(app, 'Member');
  outsider = await registerUser(app, 'Outsider');
  workspace = await createWorkspace(admin);
  await addMember(admin, workspace.id, member);
});

afterAll(async () => {
  await stopDatabase?.();
});

function errorCode(res: request.Response): string {
  return (res.body as ApiErrorResponse).error.code;
}

describe('boards', () => {
  it('creates a board with default columns, and dedupes retried requests', async () => {
    const body = { name: '  Launch  ', requestId: randomUUID() };
    const first = await member.client
      .post(`/api/workspaces/${workspace.id}/boards`)
      .send(body)
      .expect(201);
    const board = (first.body as BoardResponse).board;
    expect(board.name).toBe('Launch');
    expect(board.columns.map((c) => c.name)).toEqual(['To do', 'In progress', 'Done']);

    const retry = await member.client
      .post(`/api/workspaces/${workspace.id}/boards`)
      .send(body)
      .expect(200);
    expect((retry.body as BoardResponse).board.id).toBe(board.id);
  });

  it('lists the workspace boards and lets members rename them', async () => {
    const board = await createBoard(member, workspace.id, 'Old name');
    const renamed = await member.client
      .patch(`/api/boards/${board.id}`)
      .send({ name: 'New name' })
      .expect(200);
    expect((renamed.body as BoardResponse).board.name).toBe('New name');

    const res = await admin.client.get(`/api/workspaces/${workspace.id}/boards`).expect(200);
    expect((res.body as BoardListResponse).boards.map((b) => b.id)).toContain(board.id);
  });

  it('hides boards from non-members on every endpoint (404)', async () => {
    const board = await createBoard(admin, workspace.id);
    const columnId = board.columns[0]?.id ?? '';
    const attempts = [
      outsider.client.get(`/api/workspaces/${workspace.id}/boards`),
      outsider.client
        .post(`/api/workspaces/${workspace.id}/boards`)
        .send({ name: 'x', requestId: randomUUID() }),
      outsider.client.get(`/api/boards/${board.id}`),
      outsider.client.patch(`/api/boards/${board.id}`).send({ name: 'x' }),
      outsider.client.delete(`/api/boards/${board.id}`),
      outsider.client
        .post(`/api/boards/${board.id}/columns`)
        .send({ name: 'x', requestId: randomUUID() }),
      outsider.client.patch(`/api/boards/${board.id}/columns/${columnId}`).send({ name: 'x' }),
      outsider.client.delete(`/api/boards/${board.id}/columns/${columnId}`),
      outsider.client.get(`/api/boards/${board.id}/tasks`),
      outsider.client
        .post(`/api/boards/${board.id}/tasks`)
        .send({ title: 'x', columnId, requestId: randomUUID() }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(404);
      expect(errorCode(res)).toBe('NOT_FOUND');
    }
  });

  it('only lets admins delete boards, and deletes their tasks too', async () => {
    const board = await createBoard(member, workspace.id);
    const columnId = board.columns[0]?.id ?? '';
    await createTask(member, board.id, columnId);

    const forbidden = await member.client.delete(`/api/boards/${board.id}`).expect(403);
    expect(errorCode(forbidden)).toBe('FORBIDDEN');

    await admin.client.delete(`/api/boards/${board.id}`).expect(204);
    await admin.client.get(`/api/boards/${board.id}`).expect(404);
    expect(await TaskModel.countDocuments({ boardId: board.id })).toBe(0);
  });
});

describe('columns', () => {
  let board: BoardDto;

  beforeEach(async () => {
    board = await createBoard(member, workspace.id);
  });

  it('adds, renames and deletes an empty column; retries do not duplicate', async () => {
    const body = { name: 'Review', requestId: randomUUID() };
    const created = await member.client
      .post(`/api/boards/${board.id}/columns`)
      .send(body)
      .expect(201);
    const column = (created.body as ColumnResponse).column;
    await member.client.post(`/api/boards/${board.id}/columns`).send(body).expect(200);

    await member.client
      .patch(`/api/boards/${board.id}/columns/${column.id}`)
      .send({ name: 'QA' })
      .expect(200);
    const afterRename = await member.client.get(`/api/boards/${board.id}`).expect(200);
    expect((afterRename.body as BoardResponse).board.columns.map((c) => c.name)).toEqual([
      'To do',
      'In progress',
      'Done',
      'QA',
    ]);

    await member.client.delete(`/api/boards/${board.id}/columns/${column.id}`).expect(204);
    await member.client.delete(`/api/boards/${board.id}/columns/${column.id}`).expect(404);
  });

  it('refuses to delete a column that still has tasks', async () => {
    const columnId = board.columns[0]?.id ?? '';
    await createTask(member, board.id, columnId);

    const res = await member.client
      .delete(`/api/boards/${board.id}/columns/${columnId}`)
      .expect(409);
    expect(errorCode(res)).toBe('COLUMN_NOT_EMPTY');
  });

  it(`caps a board at ${MAX_COLUMNS_PER_BOARD} columns`, async () => {
    for (let i = board.columns.length; i < MAX_COLUMNS_PER_BOARD; i += 1) {
      await member.client
        .post(`/api/boards/${board.id}/columns`)
        .send({ name: `Column ${i}`, requestId: randomUUID() })
        .expect(201);
    }
    await member.client
      .post(`/api/boards/${board.id}/columns`)
      .send({ name: 'One too many', requestId: randomUUID() })
      .expect(409);
  });

  it('validates column names', async () => {
    await member.client
      .post(`/api/boards/${board.id}/columns`)
      .send({ name: '   ', requestId: randomUUID() })
      .expect(400);
  });
});
