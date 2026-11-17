import type {
  ApiErrorResponse,
  BoardDto,
  TaskDto,
  TaskHistoryResponse,
  TaskResponse,
  WorkspaceDto,
} from '@mini-trello/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { TaskRevisionModel } from './task-revision.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspace: WorkspaceDto;
let board: BoardDto;
let task: TaskDto;

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
  task = await createTask(admin, board.id, column(0), { title: 'Draft', priority: 'low' });
});

async function history(user: TestUser = admin, query = '') {
  const res = await user.client.get(`/api/tasks/${task.id}/history${query}`).expect(200);
  return res.body as TaskHistoryResponse;
}

async function edit(version: number, fields: Record<string, unknown>, user = admin) {
  const res = await user.client
    .patch(`/api/tasks/${task.id}`)
    .send({ version, ...fields })
    .expect(200);
  return (res.body as TaskResponse).task;
}

describe('recording history', () => {
  it('records one revision per version with who, what and old → new values', async () => {
    await edit(1, { title: 'Final', priority: 'high', assigneeId: member.user.id }, member);
    await admin.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 2, columnId: column(2), index: 0 })
      .expect(200);

    const { revisions } = await history();
    expect(revisions.map((r) => [r.version, r.action])).toEqual([
      [3, 'moved'],
      [2, 'edited'],
      [1, 'created'],
    ]);
    expect(revisions[1]).toMatchObject({
      actorId: member.user.id,
      changes: [
        { field: 'title', from: 'Draft', to: 'Final' },
        { field: 'priority', from: 'low', to: 'high' },
        { field: 'assigneeId', from: null, to: member.user.id },
      ],
    });
    expect(revisions[0]?.changes).toEqual([
      { field: 'status', from: board.columns[0]?.name, to: board.columns[2]?.name },
    ]);
    expect(revisions[2]?.snapshot).toMatchObject({ title: 'Draft', priority: 'low' });
  });

  it('records nothing for a rejected edit', async () => {
    await edit(1, { title: 'A' });
    await admin.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'B' }).expect(409);
    expect((await history()).revisions).toHaveLength(2);
  });

  it('pages newest first', async () => {
    await edit(1, { title: 'v2' });
    await edit(2, { title: 'v3' });
    const first = await history(admin, '?limit=2');
    expect(first.revisions.map((r) => r.version)).toEqual([3, 2]);
    const rest = await history(admin, `?limit=2&cursor=${first.nextCursor ?? ''}`);
    expect(rest.revisions.map((r) => r.version)).toEqual([1]);
    expect(rest.nextCursor).toBeNull();
  });

  it('is only visible to workspace members, and removed with the task', async () => {
    await outsider.client.get(`/api/tasks/${task.id}/history`).expect(404);
    await admin.client.delete(`/api/tasks/${task.id}`).expect(204);
    expect(await TaskRevisionModel.countDocuments({ taskId: task.id })).toBe(0);
  });
});

describe('restoring a version', () => {
  it("brings back an earlier version's content as a new version", async () => {
    await edit(1, { title: 'Changed', description: 'More', dueDate: '2026-12-01' });
    await admin.client
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 2, columnId: column(1), index: 0 })
      .expect(200);

    const res = await member.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 3, toVersion: 1 })
      .expect(200);
    expect((res.body as TaskResponse).task).toMatchObject({
      title: 'Draft',
      description: '',
      dueDate: null,
      // Status is a workflow step, not content: the card stays where it is.
      columnId: column(1),
      version: 4,
    });
    expect((await history()).revisions[0]).toMatchObject({
      version: 4,
      action: 'restored',
      restoredFrom: 1,
      actorId: member.user.id,
    });
  });

  it("refuses to restore over someone else's newer change", async () => {
    await edit(1, { title: 'Second' });
    await edit(2, { title: 'Third' }, member);
    const res = await admin.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 2, toVersion: 1 })
      .expect(409);
    expect((res.body as ApiErrorResponse).error.code).toBe('VERSION_CONFLICT');
  });

  it('reports when there is nothing to restore, or no such version', async () => {
    await edit(1, { priority: 'high' });
    await edit(2, { priority: 'low' });
    const same = await admin.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 3, toVersion: 1 })
      .expect(400);
    expect((same.body as ApiErrorResponse).error.code).toBe('NOTHING_TO_RESTORE');
    await admin.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 3, toVersion: 99 })
      .expect(404);
  });

  it('leaves the task unassigned when the old assignee has left the workspace', async () => {
    const leaver = await registerUser(app, 'Leaver');
    await addMember(admin, workspace.id, leaver);
    await edit(1, { assigneeId: leaver.user.id });
    await edit(2, { assigneeId: null, title: 'Reworded' });
    await admin.client
      .delete(`/api/workspaces/${workspace.id}/members/${leaver.user.id}`)
      .expect(204);

    const res = await admin.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 3, toVersion: 2 })
      .expect(200);
    expect((res.body as TaskResponse).task).toMatchObject({ title: 'Draft', assigneeId: null });
  });

  it('records the unassignment when a member is removed, so no version is missing', async () => {
    const leaver = await registerUser(app, 'Leaver Two');
    await addMember(admin, workspace.id, leaver);
    await edit(1, { assigneeId: leaver.user.id });
    await admin.client
      .delete(`/api/workspaces/${workspace.id}/members/${leaver.user.id}`)
      .expect(204);

    const { revisions } = await history();
    expect(revisions.map((r) => r.version)).toEqual([3, 2, 1]);
    expect(revisions[0]).toMatchObject({
      action: 'edited',
      actorId: admin.user.id,
      changes: [{ field: 'assigneeId', from: leaver.user.id, to: null }],
    });
  });
});
