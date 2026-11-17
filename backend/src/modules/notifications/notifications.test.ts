import { randomUUID } from 'node:crypto';

import type {
  BoardDto,
  CommentResponse,
  MarkAllReadResponse,
  NotificationListResponse,
  NotificationResponse,
  UnreadCountResponse,
  WorkspaceDto,
} from '@mini-trello/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { addMember, createBoard, createTask, createWorkspace } from '../../test/fixtures';
import { registerUser, type TestUser } from '../../test/http';
import { startTestDatabase } from '../../test/mongo-memory';
import { NotificationModel } from './notification.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;
let admin: TestUser;
let sara: TestUser;
let ali: TestUser;
let outsider: TestUser;
let workspace: WorkspaceDto;
let board: BoardDto;

const column = () => board.columns[0]?.id ?? '';

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
  admin = await registerUser(app, 'Admin Person');
  sara = await registerUser(app, 'Sara Khan');
  ali = await registerUser(app, 'Ali Raza');
  outsider = await registerUser(app, 'Outsider');
  workspace = await createWorkspace(admin);
  await addMember(admin, workspace.id, sara);
  await addMember(admin, workspace.id, ali);
});

afterAll(async () => {
  await stopDatabase?.();
});

beforeEach(async () => {
  await NotificationModel.deleteMany({});
  board = await createBoard(admin, workspace.id);
});

async function inbox(user: TestUser, query = '') {
  const res = await user.client.get(`/api/notifications${query}`).expect(200);
  return res.body as NotificationListResponse;
}

function comment(user: TestUser, taskId: string, body: string, mentionIds: string[]) {
  return user.client
    .post(`/api/tasks/${taskId}/comments`)
    .send({ body, mentionIds, requestId: randomUUID() });
}

describe('assignment notifications', () => {
  it('notifies a member assigned when the task is created', async () => {
    await createTask(admin, board.id, column(), { title: 'Fix login', assigneeId: sara.user.id });
    const { notifications, unreadCount } = await inbox(sara);
    expect(unreadCount).toBe(1);
    expect(notifications[0]).toMatchObject({
      type: 'task.assigned',
      actorId: admin.user.id,
      actorName: 'Admin Person',
      boardId: board.id,
      taskTitle: 'Fix login',
      read: false,
    });
  });

  it('notifies on reassignment only, never for assigning yourself', async () => {
    const task = await createTask(admin, board.id, column());
    await sara.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: sara.user.id })
      .expect(200);
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 2, title: 'Renamed' })
      .expect(200);
    expect((await inbox(sara)).notifications).toHaveLength(0);

    await sara.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 3, assigneeId: ali.user.id })
      .expect(200);
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 4, assigneeId: null })
      .expect(200);
    // Newest first: unassigned by the admin, after being assigned by Sara.
    const { notifications } = await inbox(ali);
    expect(notifications.map((n) => [n.type, n.actorId])).toEqual([
      ['task.unassigned', admin.user.id],
      ['task.assigned', sara.user.id],
    ]);
    expect(notifications[1]).toMatchObject({ taskTitle: 'Renamed' });
  });

  it('creates nothing when the update is rejected', async () => {
    const task = await createTask(admin, board.id, column());
    await admin.client.patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'A' }).expect(200);
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: sara.user.id })
      .expect(409);
    expect((await inbox(sara)).notifications).toHaveLength(0);
  });
});

describe('unassignment notifications', () => {
  it('tells the previous assignee when they are unassigned', async () => {
    const task = await createTask(admin, board.id, column(), {
      title: 'Fix login',
      assigneeId: sara.user.id,
    });
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: null })
      .expect(200);

    const { notifications, unreadCount } = await inbox(sara);
    expect(unreadCount).toBe(2);
    expect(notifications[0]).toMatchObject({
      type: 'task.unassigned',
      actorId: admin.user.id,
      taskTitle: 'Fix login',
      read: false,
    });
  });

  it('on reassignment, tells both the new and the previous assignee', async () => {
    const task = await createTask(admin, board.id, column(), { assigneeId: sara.user.id });
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: ali.user.id })
      .expect(200);

    expect((await inbox(sara)).notifications[0]?.type).toBe('task.unassigned');
    expect((await inbox(ali)).notifications.map((n) => n.type)).toEqual(['task.assigned']);
  });

  it('tells the assignee when restoring a version that had nobody assigned', async () => {
    const task = await createTask(admin, board.id, column());
    await admin.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: sara.user.id })
      .expect(200);
    await admin.client
      .post(`/api/tasks/${task.id}/restore`)
      .send({ version: 2, toVersion: 1 })
      .expect(200);

    expect((await inbox(sara)).notifications.map((n) => n.type)).toEqual([
      'task.unassigned',
      'task.assigned',
    ]);
  });

  it('does not notify people who unassign themselves', async () => {
    const task = await createTask(admin, board.id, column(), { assigneeId: sara.user.id });
    await sara.client
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: null })
      .expect(200);

    expect((await inbox(sara)).notifications.map((n) => n.type)).toEqual(['task.assigned']);
  });
});

describe('mention notifications', () => {
  it('notifies members mentioned by name and records them on the comment', async () => {
    const task = await createTask(admin, board.id, column(), { title: 'Launch' });
    const res = await comment(admin, task.id, '@Sara Khan and @Ali Raza please review', [
      sara.user.id,
      ali.user.id,
    ]).expect(201);

    expect((res.body as CommentResponse).comment.mentionIds).toEqual([sara.user.id, ali.user.id]);
    for (const user of [sara, ali]) {
      expect((await inbox(user)).notifications[0]).toMatchObject({
        type: 'comment.mentioned',
        taskTitle: 'Launch',
        excerpt: '@Sara Khan and @Ali Raza please review',
      });
    }
  });

  it('ignores non-members, the author, and ids whose @Name is not in the text', async () => {
    const task = await createTask(admin, board.id, column());
    const res = await comment(sara, task.id, '@Outsider @Sara Khan hello', [
      outsider.user.id, // not a member
      sara.user.id, // the author
      ali.user.id, // picked, then "@Ali Raza" was deleted from the text
    ]).expect(201);

    expect((res.body as CommentResponse).comment.mentionIds).toEqual([]);
    expect(await NotificationModel.countDocuments({})).toBe(0);
  });

  it('rejects too many mentions', async () => {
    const task = await createTask(admin, board.id, column());
    const ids = Array.from({ length: 21 }, () => sara.user.id);
    await comment(admin, task.id, 'hi', ids).expect(400);
  });
});

describe('reading notifications', () => {
  async function notifySara(times: number) {
    for (let i = 1; i <= times; i += 1) {
      await createTask(admin, board.id, column(), { title: `T${i}`, assigneeId: sara.user.id });
    }
  }

  it('pages newest first with an unread count', async () => {
    await notifySara(3);
    const first = await inbox(sara, '?limit=2');
    expect(first.notifications.map((n) => n.taskTitle)).toEqual(['T3', 'T2']);
    expect(first.unreadCount).toBe(3);
    const second = await inbox(sara, `?limit=2&cursor=${first.nextCursor ?? ''}`);
    expect(second.notifications.map((n) => n.taskTitle)).toEqual(['T1']);
    expect(second.nextCursor).toBeNull();
  });

  it('marks one as read, idempotently, and updates the count', async () => {
    await notifySara(2);
    const [latest] = (await inbox(sara)).notifications;
    const url = `/api/notifications/${latest?.id ?? ''}/read`;
    const res = await sara.client.patch(url).expect(200);
    expect((res.body as NotificationResponse).notification.read).toBe(true);
    await sara.client.patch(url).expect(200);

    const count = await sara.client.get('/api/notifications/unread-count').expect(200);
    expect((count.body as UnreadCountResponse).count).toBe(1);
  });

  it('marks all as read', async () => {
    await notifySara(3);
    const res = await sara.client.patch('/api/notifications/read-all').expect(200);
    expect((res.body as MarkAllReadResponse).updated).toBe(3);
    expect((await inbox(sara)).unreadCount).toBe(0);
  });

  it("never exposes or changes someone else's notifications", async () => {
    await notifySara(1);
    const [notification] = (await inbox(sara)).notifications;
    expect((await inbox(ali)).notifications).toHaveLength(0);
    await ali.client.patch(`/api/notifications/${notification?.id ?? ''}/read`).expect(404);
    await ali.client.patch('/api/notifications/read-all').expect(200);
    expect((await inbox(sara)).unreadCount).toBe(1);
  });

  it('requires a session', async () => {
    const res = await outsider.client.post('/api/auth/logout');
    expect(res.status).toBe(204);
    await outsider.client.get('/api/notifications').expect(401);
  });

  it('removes notifications together with their task, so no link leads to a deleted task', async () => {
    const task = await createTask(admin, board.id, column(), { assigneeId: sara.user.id });
    expect((await inbox(sara)).unreadCount).toBe(1);
    await admin.client.delete(`/api/tasks/${task.id}`).expect(204);
    const { notifications, unreadCount } = await inbox(sara);
    expect(notifications).toHaveLength(0);
    expect(unreadCount).toBe(0);
  });

  it('removes notifications together with their board', async () => {
    await notifySara(1);
    await admin.client.delete(`/api/boards/${board.id}`).expect(204);
    expect((await inbox(sara)).notifications).toHaveLength(0);
  });
});
