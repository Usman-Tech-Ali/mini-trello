import { randomUUID } from 'node:crypto';

import type { ActivityListResponse, BoardDto, WorkspaceDto } from '@mini-trello/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { ActivityModel } from './activity.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspace: WorkspaceDto;
let board: BoardDto;

const column = (index: number) => board.columns[index]?.id ?? '';

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

beforeEach(async () => {
  board = await createBoard(admin, workspace.id);
});

async function feed(user: TestUser = admin, query = '') {
  const res = await user.client.get(`/api/boards/${board.id}/activity${query}`).expect(200);
  return res.body as ActivityListResponse;
}

describe('recording activity', () => {
  it('records creation, and assignment when created with an assignee', async () => {
    await createTask(member, board.id, column(0), { title: 'Plan', assigneeId: admin.user.id });
    const { activities } = await feed();
    expect(activities.map((a) => a.action)).toEqual(['task.assigned', 'task.created']);
    expect(activities[0]).toMatchObject({
      actorId: member.user.id,
      taskTitle: 'Plan',
      details: { assigneeId: admin.user.id },
    });
  });

  it('records which fields an edit changed, and assignment separately', async () => {
    const task = await createTask(admin, board.id, column(0), { title: 'Old' });
    await member.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'New', priority: 'high', assigneeId: member.user.id })
      .expect(200);

    const [assigned, updated] = (await feed()).activities;
    expect(updated).toMatchObject({
      action: 'task.updated',
      actorId: member.user.id,
      taskTitle: 'New',
      details: { fields: ['title', 'priority'] },
    });
    expect(assigned).toMatchObject({
      action: 'task.assigned',
      details: { assigneeId: member.user.id },
    });
  });

  it('records unassignment', async () => {
    const task = await createTask(admin, board.id, column(0), { assigneeId: member.user.id });
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: null })
      .expect(200);
    expect((await feed()).activities[0]).toMatchObject({
      action: 'task.assigned',
      details: { assigneeId: null },
    });
  });

  it('records moves between columns by name, but not reordering within one', async () => {
    const task = await createTask(admin, board.id, column(0));
    await createTask(admin, board.id, column(0));
    await admin.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 1, columnId: column(0), index: 1 })
      .expect(200);
    await admin.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 2, columnId: column(2), index: 0 })
      .expect(200);

    const { activities } = await feed();
    expect(activities.filter((a) => a.action === 'task.moved')).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      action: 'task.moved',
      details: { fromColumn: board.columns[0]?.name, toColumn: board.columns[2]?.name },
    });
  });

  it('records comments with an excerpt, and deletions with the last title', async () => {
    const task = await createTask(admin, board.id, column(0), { title: 'Short-lived' });
    await member.client
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: 'y'.repeat(300), requestId: randomUUID() })
      .expect(201);
    await admin.client.delete(`/api/tasks/${task.id}`).expect(204);

    const [deleted, commented] = (await feed()).activities;
    expect(deleted).toMatchObject({ action: 'task.deleted', taskTitle: 'Short-lived' });
    expect(commented?.action).toBe('comment.created');
    expect(commented?.details.excerpt).toHaveLength(120);
  });

  it('records nothing when the write is rejected', async () => {
    const task = await createTask(admin, board.id, column(0));
    await admin.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'A' }).expect(200);
    await member.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'B' }).expect(409);
    await member.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 1, columnId: column(1), index: 0 })
      .expect(409);
    expect((await feed()).activities.map((a) => a.action)).toEqual([
      'task.updated',
      'task.created',
    ]);
  });

  it('does not record a deduplicated retry twice', async () => {
    const body = { title: 'Once', columnId: column(0), requestId: randomUUID() };
    await admin.client.post(`/api/boards/${board.id}/tasks`).send(body).expect(201);
    await admin.client.post(`/api/boards/${board.id}/tasks`).send(body).expect(200);
    expect((await feed()).activities).toHaveLength(1);
  });
});

describe('reading the feed', () => {
  it('pages from newest to oldest with a cursor', async () => {
    for (const title of ['1', '2', '3', '4', '5']) {
      await createTask(admin, board.id, column(0), { title });
    }
    const first = await feed(member, '?limit=2');
    expect(first.activities.map((a) => a.taskTitle)).toEqual(['5', '4']);

    const second = await feed(member, `?limit=2&cursor=${first.nextCursor ?? ''}`);
    expect(second.activities.map((a) => a.taskTitle)).toEqual(['3', '2']);

    const last = await feed(member, `?limit=2&cursor=${second.nextCursor ?? ''}`);
    expect(last.activities.map((a) => a.taskTitle)).toEqual(['1']);
    expect(last.nextCursor).toBeNull();
  });

  it('is only visible to workspace members', async () => {
    await outsider.client.get(`/api/boards/${board.id}/activity`).expect(404);
  });

  it('validates the query string', async () => {
    await admin.client.get(`/api/boards/${board.id}/activity?limit=500`).expect(400);
  });

  it('is removed together with its board', async () => {
    await createTask(admin, board.id, column(0));
    await admin.client.delete(`/api/boards/${board.id}`).expect(204);
    expect(await ActivityModel.countDocuments({ boardId: board.id })).toBe(0);
  });
});
