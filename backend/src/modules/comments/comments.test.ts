import { randomUUID } from 'node:crypto';

import type {
  ApiErrorResponse,
  BoardDto,
  CommentListResponse,
  CommentResponse,
  TaskDto,
  WorkspaceDto,
} from '@mini-trello/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { CommentModel } from './comment.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;
let admin: TestUser;
let member: TestUser;
let outsider: TestUser;
let workspace: WorkspaceDto;
let board: BoardDto;
let task: TaskDto;

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
  task = await createTask(admin, board.id, board.columns[0]?.id ?? '');
});

function postComment(user: TestUser, body: string, requestId = randomUUID()) {
  return user.client.post(`/api/tasks/${task.id}/comments`).send({ body, requestId });
}

async function listComments(user: TestUser, query = '') {
  const res = await user.client.get(`/api/tasks/${task.id}/comments${query}`).expect(200);
  return res.body as CommentListResponse;
}

describe('posting comments', () => {
  it('stores a trimmed comment with its author', async () => {
    const res = await postComment(member, '  Looks good  ').expect(201);
    expect((res.body as CommentResponse).comment).toMatchObject({
      taskId: task.id,
      boardId: board.id,
      authorId: member.user.id,
      body: 'Looks good',
    });
  });

  it('rejects empty and oversized comments', async () => {
    const empty = await postComment(member, '   ').expect(400);
    expect((empty.body as ApiErrorResponse).error.details?.body).toBeDefined();
    await postComment(member, 'x'.repeat(2001)).expect(400);
  });

  it('returns the original comment when a request is retried', async () => {
    const requestId = randomUUID();
    const first = await postComment(member, 'Once', requestId).expect(201);
    const retry = await postComment(member, 'Once', requestId).expect(200);
    expect((retry.body as CommentResponse).comment.id).toBe(
      (first.body as CommentResponse).comment.id,
    );
    expect(await CommentModel.countDocuments({ taskId: task.id })).toBe(1);
  });

  it('limits how fast one person can post comments', async () => {
    const chatty = await registerUser(app, 'Chatty');
    await addMember(admin, workspace.id, chatty);
    for (let i = 0; i < 30; i += 1) await postComment(chatty, `Comment ${i}`).expect(201);
    const res = await postComment(chatty, 'One too many').expect(429);
    expect((res.body as ApiErrorResponse).error.code).toBe('RATE_LIMITED');
    // Other people are not affected.
    await postComment(member, 'Still fine').expect(201);
  });

  it('hides tasks from non-members', async () => {
    await postComment(outsider, 'Let me in').expect(404);
    await outsider.client.get(`/api/tasks/${task.id}/comments`).expect(404);
  });
});

describe('listing comments', () => {
  it('returns comments oldest first', async () => {
    for (const body of ['one', 'two', 'three']) await postComment(member, body).expect(201);
    const { comments, nextCursor } = await listComments(admin);
    expect(comments.map((c) => c.body)).toEqual(['one', 'two', 'three']);
    expect(nextCursor).toBeNull();
  });

  it('pages backwards from the newest comments', async () => {
    for (const body of ['1', '2', '3', '4', '5']) await postComment(member, body).expect(201);

    const latest = await listComments(admin, '?limit=2');
    expect(latest.comments.map((c) => c.body)).toEqual(['4', '5']);
    expect(latest.nextCursor).toBe(latest.comments[0]?.id);

    const earlier = await listComments(admin, `?limit=2&cursor=${latest.nextCursor ?? ''}`);
    expect(earlier.comments.map((c) => c.body)).toEqual(['2', '3']);

    const first = await listComments(admin, `?limit=2&cursor=${earlier.nextCursor ?? ''}`);
    expect(first.comments.map((c) => c.body)).toEqual(['1']);
    expect(first.nextCursor).toBeNull();
  });

  it('validates the query string', async () => {
    await admin.client.get(`/api/tasks/${task.id}/comments?limit=0`).expect(400);
    await admin.client.get(`/api/tasks/${task.id}/comments?cursor=nope`).expect(400);
  });

  it('removes comments together with their task', async () => {
    await postComment(member, 'Soon gone').expect(201);
    await admin.client.delete(`/api/tasks/${task.id}`).expect(204);
    expect(await CommentModel.countDocuments({ taskId: task.id })).toBe(0);
  });

  it('removes comments together with their board', async () => {
    await postComment(member, 'Soon gone').expect(201);
    await admin.client.delete(`/api/boards/${board.id}`).expect(204);
    expect(await CommentModel.countDocuments({ boardId: board.id })).toBe(0);
  });
});
