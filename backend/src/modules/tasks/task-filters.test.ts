import type { BoardDto, TaskListResponse, WorkspaceDto } from '@mini-trello/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';

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
  board = await createBoard(admin, workspace.id);
  await createTask(admin, board.id, column(0), {
    title: 'Fix login bug',
    priority: 'high',
    assigneeId: member.user.id,
  });
  await createTask(admin, board.id, column(0), { title: 'Write login docs', priority: 'low' });
  await createTask(admin, board.id, column(1), {
    title: 'Release v1.0 (beta)',
    priority: 'high',
    assigneeId: admin.user.id,
  });
  await createTask(admin, board.id, column(2), {
    title: 'Plan sprint',
    priority: 'medium',
    assigneeId: member.user.id,
  });
});

afterAll(async () => {
  await stopDatabase?.();
});

async function titles(query: string, user: TestUser = admin): Promise<string[]> {
  const res = await user.client.get(`/api/boards/${board.id}/tasks${query}`).expect(200);
  return (res.body as TaskListResponse).tasks.map((task) => task.title).sort();
}

describe('filtering board tasks', () => {
  it('returns every task without filters', async () => {
    expect(await titles('')).toHaveLength(4);
  });

  it('searches titles case-insensitively, anywhere in the title', async () => {
    expect(await titles('?q=LOGIN')).toEqual(['Fix login bug', 'Write login docs']);
    expect(await titles('?q=%20sprint%20')).toEqual(['Plan sprint']);
  });

  it('treats search text literally, not as a pattern', async () => {
    expect(await titles(`?q=${encodeURIComponent('v1.0 (beta)')}`)).toEqual([
      'Release v1.0 (beta)',
    ]);
    expect(await titles(`?q=${encodeURIComponent('.*')}`)).toEqual([]);
  });

  it('filters by assignee, including unassigned', async () => {
    expect(await titles(`?assignee=${member.user.id}`)).toEqual(['Fix login bug', 'Plan sprint']);
    expect(await titles('?assignee=unassigned')).toEqual(['Write login docs']);
  });

  it('filters by priority and by column', async () => {
    expect(await titles('?priority=high')).toEqual(['Fix login bug', 'Release v1.0 (beta)']);
    expect(await titles(`?column=${column(0)}`)).toEqual(['Fix login bug', 'Write login docs']);
  });

  it('combines filters', async () => {
    expect(await titles(`?q=login&priority=high&assignee=${member.user.id}`)).toEqual([
      'Fix login bug',
    ]);
    expect(await titles(`?priority=high&column=${column(2)}`)).toEqual([]);
  });

  it('rejects invalid filter values', async () => {
    for (const query of [
      '?priority=urgent',
      '?assignee=nobody',
      '?column=x',
      `?q=${'a'.repeat(201)}`,
    ]) {
      await admin.client.get(`/api/boards/${board.id}/tasks${query}`).expect(400);
    }
  });

  it('is only available to workspace members', async () => {
    await outsider.client.get(`/api/boards/${board.id}/tasks?q=login`).expect(404);
  });
});
