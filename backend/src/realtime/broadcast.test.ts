import type {
  BoardDto,
  BoardResponse,
  CommentResponse,
  TaskDto,
  TaskResponse,
  WorkspaceResponse,
} from '@mini-trello/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startTestDatabase } from '../test/mongo-memory';
import {
  connectSocket,
  joinBoard,
  newRequestId,
  nextEvent,
  receives,
  registerSessionUser,
  restAs,
  startRealtimeServer,
  type ClientSocket,
  type RealtimeTestServer,
  type SessionUser,
} from '../test/realtime';

let stopDatabase: (() => Promise<void>) | undefined;
let server: RealtimeTestServer;
let alice: SessionUser;
let bob: SessionUser;
let workspaceId: string;
let board: BoardDto;
let aliceSocket: ClientSocket;
let bobSocket: ClientSocket;

const column = (index: number) => board.columns[index]?.id ?? '';
/** Alice's REST calls carry her socket id, like the real client does. */
const aliceApi = () => restAs(server.http, alice, aliceSocket.id);

async function createTask(title: string): Promise<TaskDto> {
  const res = await aliceApi()
    .post(`/api/boards/${board.id}/tasks`)
    .send({ title, columnId: column(0), requestId: newRequestId() })
    .expect(201);
  return (res.body as TaskResponse).task;
}

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
  server = await startRealtimeServer();
  alice = await registerSessionUser(server.http, 'Alice');
  bob = await registerSessionUser(server.http, 'Bob');
  const api = restAs(server.http, alice);
  const ws = await api.post('/api/workspaces').send({ name: 'Live', requestId: newRequestId() });
  workspaceId = (ws.body as WorkspaceResponse).workspace.id;
});

beforeEach(async () => {
  const api = restAs(server.http, alice);
  await api.post(`/api/workspaces/${workspaceId}/members`).send({ email: bob.user.email });
  const res = await api
    .post(`/api/workspaces/${workspaceId}/boards`)
    .send({ name: 'Board', requestId: newRequestId() });
  board = (res.body as BoardResponse).board;
  aliceSocket = await connectSocket(server.url, { cookie: alice.cookie });
  bobSocket = await connectSocket(server.url, { cookie: bob.cookie });
  await joinBoard(aliceSocket, board.id);
  await joinBoard(bobSocket, board.id);
});

afterEach(() => {
  aliceSocket.close();
  bobSocket.close();
});

afterAll(async () => {
  await server.close();
  await stopDatabase?.();
});

describe('task broadcasts', () => {
  it('sends a created task to other members but not back to its sender', async () => {
    const bobGets = nextEvent(bobSocket, 'task:created');
    const aliceGets = receives(aliceSocket, 'task:created');
    const task = await createTask('Live task');

    expect(await bobGets).toEqual({ boardId: board.id, task });
    expect(await aliceGets).toBe(false);
  });

  it('does not broadcast a deduplicated retry twice', async () => {
    const body = { title: 'Once', columnId: column(0), requestId: newRequestId() };
    const first = nextEvent(bobSocket, 'task:created');
    await aliceApi().post(`/api/boards/${board.id}/tasks`).send(body).expect(201);
    await first;

    const second = receives(bobSocket, 'task:created');
    await aliceApi().post(`/api/boards/${board.id}/tasks`).send(body).expect(200);
    expect(await second).toBe(false);
  });

  it('broadcasts edits and moves with the new version', async () => {
    const task = await createTask('Edit me');

    const edited = nextEvent(bobSocket, 'task:updated');
    await aliceApi()
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'Edited' })
      .expect(200);
    expect((await edited).task).toMatchObject({ title: 'Edited', version: 2 });

    const moved = nextEvent(bobSocket, 'task:updated');
    await aliceApi()
      .patch(`/api/tasks/${task.id}/move`)
      .send({ version: 2, columnId: column(2), index: 0 })
      .expect(200);
    expect((await moved).task).toMatchObject({ columnId: column(2), version: 3 });
  });

  it('never broadcasts a change whose write failed', async () => {
    const task = await createTask('Contested');
    await aliceApi()
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'First' })
      .expect(200);

    const broadcast = receives(bobSocket, 'task:updated');
    await aliceApi()
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, title: 'Stale' })
      .expect(409);
    expect(await broadcast).toBe(false);
  });

  it('broadcasts deletions', async () => {
    const task = await createTask('Doomed');
    const deleted = nextEvent(bobSocket, 'task:deleted');
    await aliceApi().delete(`/api/tasks/${task.id}`).expect(204);
    expect(await deleted).toEqual({ boardId: board.id, taskId: task.id });
  });
});

describe('board broadcasts', () => {
  it('sends the updated board when columns change', async () => {
    const added = nextEvent(bobSocket, 'board:updated');
    await aliceApi()
      .post(`/api/boards/${board.id}/columns`)
      .send({ name: 'Review', requestId: newRequestId() })
      .expect(201);
    expect((await added).board.columns.map((c) => c.name)).toEqual([
      'To do',
      'In progress',
      'Done',
      'Review',
    ]);

    const renamed = nextEvent(bobSocket, 'board:updated');
    await aliceApi().patch(`/api/boards/${board.id}`).send({ name: 'Renamed' }).expect(200);
    expect((await renamed).board.name).toBe('Renamed');
  });

  it('tells everyone on a board when it is deleted', async () => {
    const deleted = nextEvent(bobSocket, 'board:deleted');
    await aliceApi().delete(`/api/boards/${board.id}`).expect(204);
    expect(await deleted).toEqual({ boardId: board.id });
  });
});

describe('access revocation', () => {
  it('removes a member from live board rooms as soon as they leave the workspace', async () => {
    const revoked = nextEvent(bobSocket, 'board:access-revoked');
    const stale = nextEvent(aliceSocket, 'board:stale');
    await aliceApi().delete(`/api/workspaces/${workspaceId}/members/${bob.user.id}`).expect(204);
    expect(await revoked).toEqual({ boardId: board.id });
    expect(await stale).toEqual({ boardId: board.id });

    const leaked = receives(bobSocket, 'task:created');
    await createTask('Private now');
    expect(await leaked).toBe(false);

    const rejoin = await joinBoard(bobSocket, board.id);
    expect(rejoin.ok).toBe(false);
  });
});

describe('comment and activity broadcasts', () => {
  it('sends a new comment to other members but not back to its author', async () => {
    const task = await createTask('Discuss');
    const bobGets = nextEvent(bobSocket, 'comment:created');
    const aliceGets = receives(aliceSocket, 'comment:created');
    const res = await aliceApi()
      .post(`/api/tasks/${task.id}/comments`)
      .send({ body: 'Thoughts?', requestId: newRequestId() })
      .expect(201);

    expect(await bobGets).toEqual({
      boardId: board.id,
      comment: (res.body as CommentResponse).comment,
    });
    expect(await aliceGets).toBe(false);
  });

  it('sends activity to everyone on the board, the actor included', async () => {
    const aliceGets = nextEvent(aliceSocket, 'activity:created');
    const bobGets = nextEvent(bobSocket, 'activity:created');
    const task = await createTask('Tracked');

    for (const payload of [await aliceGets, await bobGets]) {
      expect(payload).toMatchObject({
        boardId: board.id,
        activity: { action: 'task.created', taskId: task.id, actorId: alice.user.id },
      });
    }
  });

  it('sends no activity when the write fails', async () => {
    const task = await createTask('Contested');
    await aliceApi().patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'A' }).expect(200);

    const broadcast = receives(bobSocket, 'activity:created');
    await aliceApi().patch(`/api/tasks/${task.id}`).send({ version: 1, title: 'B' }).expect(409);
    expect(await broadcast).toBe(false);
  });
});

describe('personal workspace events', () => {
  it('tells a user, on every open tab, when they are added, re-roled or removed', async () => {
    const carol = await registerSessionUser(server.http, 'Carol');
    const [tab1, tab2] = await Promise.all([
      connectSocket(server.url, { cookie: carol.cookie }),
      connectSocket(server.url, { cookie: carol.cookie }),
    ]);
    const api = restAs(server.http, alice);
    try {
      const added = Promise.all([
        nextEvent(tab1, 'workspaces:changed'),
        nextEvent(tab2, 'workspaces:changed'),
      ]);
      const bobHears = receives(bobSocket, 'workspaces:changed');
      await api
        .post(`/api/workspaces/${workspaceId}/members`)
        .send({ email: carol.user.email })
        .expect(201);
      expect(await added).toEqual([{ workspaceId }, { workspaceId }]);
      expect(await bobHears).toBe(false);

      const promoted = nextEvent(tab1, 'workspaces:changed');
      await api
        .patch(`/api/workspaces/${workspaceId}/members/${carol.user.id}`)
        .send({ role: 'admin' })
        .expect(200);
      expect(await promoted).toEqual({ workspaceId });

      const removed = nextEvent(tab1, 'workspaces:changed');
      await api.delete(`/api/workspaces/${workspaceId}/members/${carol.user.id}`).expect(204);
      expect(await removed).toEqual({ workspaceId });
    } finally {
      tab1.close();
      tab2.close();
    }
  });
});

describe('notification delivery', () => {
  it('delivers a notification only to the recipient, after the write', async () => {
    const task = await createTask('Needs an owner');
    const bobGets = nextEvent(bobSocket, 'notification:created');
    const aliceGets = receives(aliceSocket, 'notification:created');
    await aliceApi()
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: bob.user.id })
      .expect(200);

    expect((await bobGets).notification).toMatchObject({
      type: 'task.assigned',
      actorId: alice.user.id,
      taskId: task.id,
    });
    expect(await aliceGets).toBe(false);
  });

  it("tells the recipient's tabs when notifications are read", async () => {
    const task = await createTask('Owned');
    const delivered = nextEvent(bobSocket, 'notification:created');
    await aliceApi()
      .patch(`/api/tasks/${task.id}`)
      .send({ version: 1, assigneeId: bob.user.id })
      .expect(200);
    const { notification } = await delivered;

    const changed = receives(bobSocket, 'notifications:changed', 1_000);
    await restAs(server.http, bob).patch(`/api/notifications/${notification.id}/read`).expect(200);
    expect(await changed).toBe(true);
  });
});
