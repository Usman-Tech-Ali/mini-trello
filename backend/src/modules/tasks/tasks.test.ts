import { randomUUID } from 'node:crypto';

import type {
  ApiErrorResponse,
  BoardDto,
  TaskDto,
  TaskListResponse,
  TaskResponse,
  WorkspaceDto,
} from '@mini-trello/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, TEST_ORIGIN, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { TaskModel } from './task.model';

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

function errorBody(res: request.Response) {
  return (res.body as ApiErrorResponse).error;
}

function column(board: BoardDto, index: number): string {
  const id = board.columns[index]?.id;
  if (!id) throw new Error(`Board has no column ${index}`);
  return id;
}

async function titlesByColumn(user: TestUser, board: BoardDto): Promise<string[][]> {
  const res = await user.client.get(`/api/boards/${board.id}/tasks`).expect(200);
  const { tasks } = res.body as TaskListResponse;
  return board.columns.map((c) => tasks.filter((t) => t.columnId === c.id).map((t) => t.title));
}

let board: BoardDto;

beforeEach(async () => {
  board = await createBoard(admin, workspace.id);
});

describe('creating tasks', () => {
  it('applies defaults and records the creator', async () => {
    const task = await createTask(member, board.id, column(board, 0), { title: '  Write spec ' });
    expect(task).toMatchObject({
      title: 'Write spec',
      description: '',
      priority: 'medium',
      assigneeId: null,
      dueDate: null,
      creatorId: member.user.id,
      columnId: column(board, 0),
      version: 1,
    });
  });

  it('stores every task field, keeping the due date as a calendar date', async () => {
    const task = await createTask(member, board.id, column(board, 1), {
      title: 'Ship it',
      description: 'Release notes too',
      priority: 'high',
      assigneeId: admin.user.id,
      dueDate: '2026-12-01',
    });
    expect(task).toMatchObject({
      priority: 'high',
      assigneeId: admin.user.id,
      dueDate: '2026-12-01',
      description: 'Release notes too',
    });
  });

  it('returns the original task when a create request is retried', async () => {
    const body = { title: 'Once', columnId: column(board, 0), requestId: randomUUID() };
    const first = await member.client.post(`/api/boards/${board.id}/tasks`).send(body).expect(201);
    const retry = await member.client.post(`/api/boards/${board.id}/tasks`).send(body).expect(200);
    expect((retry.body as TaskResponse).task.id).toBe((first.body as TaskResponse).task.id);
    expect(await TaskModel.countDocuments({ requestId: body.requestId })).toBe(1);
  });

  it('rejects invalid fields, foreign columns and non-member assignees', async () => {
    const other = await createBoard(admin, workspace.id, 'Other');
    const base = { requestId: randomUUID() };

    const invalid = await member.client
      .post(`/api/boards/${board.id}/tasks`)
      .send({ ...base, title: '', columnId: column(board, 0), priority: 'urgent' })
      .expect(400);
    expect(Object.keys(errorBody(invalid).details ?? {}).sort()).toEqual(['priority', 'title']);

    const foreignColumn = await member.client
      .post(`/api/boards/${board.id}/tasks`)
      .send({ ...base, title: 'x', columnId: column(other, 0) })
      .expect(400);
    expect(errorBody(foreignColumn).details).toHaveProperty('columnId');

    const outsiderAssignee = await member.client
      .post(`/api/boards/${board.id}/tasks`)
      .send({ ...base, title: 'x', columnId: column(board, 0), assigneeId: outsider.user.id })
      .expect(400);
    expect(errorBody(outsiderAssignee).details).toHaveProperty('assigneeId');
  });
});

describe('updating tasks (optimistic concurrency)', () => {
  let task: TaskDto;

  beforeEach(async () => {
    task = await createTask(member, board.id, column(board, 0), { title: 'Original' });
  });

  it('applies an update with the current version and bumps it', async () => {
    const res = await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'Edited', priority: 'low', assigneeId: member.user.id })
      .expect(200);
    expect((res.body as TaskResponse).task).toMatchObject({
      title: 'Edited',
      priority: 'low',
      assigneeId: member.user.id,
      version: 2,
    });
  });

  it('rejects a stale version with 409 and leaves the task unchanged', async () => {
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'First' })
      .expect(200);

    const stale = await member.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'Second' })
      .expect(409);
    expect(errorBody(stale).code).toBe('VERSION_CONFLICT');

    const current = await member.client.get(`/api/tasks/${task.id}`).expect(200);
    expect((current.body as TaskResponse).task).toMatchObject({ title: 'First', version: 2 });
  });

  it('lets exactly one of two simultaneous edits win', async () => {
    const results = await Promise.all([
      admin.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'From admin' }),
      member.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'From member' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await TaskModel.findById(task.id))?.version).toBe(2);
  });

  it('clears optional fields with null and rejects empty updates', async () => {
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: member.user.id, dueDate: '2026-11-30' })
      .expect(200);
    const cleared = await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 2, assigneeId: null, dueDate: null })
      .expect(200);
    expect((cleared.body as TaskResponse).task).toMatchObject({ assigneeId: null, dueDate: null });

    await admin.client.patch(`/api/tasks/${task.id}`).send({ version: 3 }).expect(400);
  });
});

describe('moving tasks', () => {
  it('reorders within a column and moves across columns', async () => {
    const a = await createTask(member, board.id, column(board, 0), { title: 'A' });
    await createTask(member, board.id, column(board, 0), { title: 'B' });
    const c = await createTask(member, board.id, column(board, 0), { title: 'C' });

    await member.client
      .patch(`/api/tasks/${c.id}/move`)
      .send({ version: 1, columnId: column(board, 0), index: 0 })
      .expect(200);
    expect(await titlesByColumn(member, board)).toEqual([['C', 'A', 'B'], [], []]);

    const moved = await member.client
      .patch(`/api/tasks/${a.id}/move`)
      .send({ version: 1, columnId: column(board, 2), index: 0 })
      .expect(200);
    expect((moved.body as TaskResponse).task).toMatchObject({
      columnId: column(board, 2),
      version: 2,
    });
    expect(await titlesByColumn(member, board)).toEqual([['C', 'B'], [], ['A']]);
  });

  it('keeps order correct after many moves into the same gap', async () => {
    const first = await createTask(member, board.id, column(board, 0), { title: 'first' });
    await createTask(member, board.id, column(board, 0), { title: 'last' });
    for (let i = 0; i < 60; i += 1) {
      const t = await createTask(member, board.id, column(board, 1), { title: `t${i}` });
      await member.client
        .patch(`/api/tasks/${t.id}/move`)
        .send({ version: 1, columnId: column(board, 0), index: 1 })
        .expect(200);
    }
    const [todo] = await titlesByColumn(member, board);
    expect(todo?.[0]).toBe(first.title);
    expect(todo?.at(-1)).toBe('last');
    expect(todo).toHaveLength(62);
  });

  it('rejects stale versions and columns from other boards', async () => {
    const other = await createBoard(admin, workspace.id, 'Other');
    const task = await createTask(member, board.id, column(board, 0));

    await member.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 1, columnId: column(other, 0), index: 0 })
      .expect(400);

    await member.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'Edited' })
      .expect(200);
    const stale = await member.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 1, columnId: column(board, 1), index: 0 })
      .expect(409);
    expect(errorBody(stale).code).toBe('VERSION_CONFLICT');
  });
});

describe('deleting and isolation', () => {
  it('deletes a task; a second delete is 404', async () => {
    const task = await createTask(member, board.id, column(board, 0));
    await member.client.delete(`/api/tasks/${task.id}`).expect(204);
    await member.client.delete(`/api/tasks/${task.id}`).expect(404);
  });

  it('hides tasks from non-members on every endpoint (404)', async () => {
    const task = await createTask(member, board.id, column(board, 0));
    const attempts = [
      outsider.client.get(`/api/tasks/${task.id}`),
      outsider.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'x' }),
      outsider.client
        .patch(`/api/tasks/${task.id}/move`)
        .send({ version: 1, columnId: column(board, 1), index: 0 }),
      outsider.client.delete(`/api/tasks/${task.id}`),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);
    expect(await TaskModel.exists({ _id: task.id })).not.toBeNull();
  });

  it('unassigns a member’s tasks when they are removed from the workspace', async () => {
    const temp = await registerUser(app, 'Temp');
    await addMember(admin, workspace.id, temp);
    const task = await createTask(member, board.id, column(board, 0), { assigneeId: temp.user.id });

    await admin.client
      .delete(`/api/workspaces/${workspace.id}/members/${temp.user.id}`)
      .expect(204);

    const after = await TaskModel.findById(task.id).lean();
    expect(after?.assigneeId).toBeNull();
    expect(after?.version).toBe(2);
  });
});

describe('dev client-log endpoint', () => {
  it('is not mounted outside development', async () => {
    await request(app)
      .post('/api/dev/client-logs')
      .set('Origin', TEST_ORIGIN)
      .send({ level: 'error', message: 'x', url: '/', source: 'console.error' })
      .expect(404);
  });
});
