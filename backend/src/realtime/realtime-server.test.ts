import type { BoardResponse, TaskResponse, WorkspaceResponse } from '@mini-trello/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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
let outsider: SessionUser;
let boardId: string;
let taskId: string;
const sockets: ClientSocket[] = [];

async function open(user: SessionUser): Promise<ClientSocket> {
  const socket = await connectSocket(server.url, { cookie: user.cookie });
  sockets.push(socket);
  return socket;
}

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
  server = await startRealtimeServer();
  alice = await registerSessionUser(server.http, 'Alice');
  bob = await registerSessionUser(server.http, 'Bob');
  outsider = await registerSessionUser(server.http, 'Outsider');

  const api = restAs(server.http, alice);
  const ws = await api.post('/api/workspaces').send({ name: 'Live', requestId: newRequestId() });
  const workspaceId = (ws.body as WorkspaceResponse).workspace.id;
  await api
    .post(`/api/workspaces/${workspaceId}/members`)
    .send({ email: bob.user.email })
    .expect(201);
  const board = await api
    .post(`/api/workspaces/${workspaceId}/boards`)
    .send({ name: 'Live board', requestId: newRequestId() });
  const created = (board.body as BoardResponse).board;
  boardId = created.id;
  const task = await api
    .post(`/api/boards/${boardId}/tasks`)
    .send({ title: 'Typing target', columnId: created.columns[0]?.id, requestId: newRequestId() });
  taskId = (task.body as TaskResponse).task.id;
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
});

afterAll(async () => {
  await server.close();
  await stopDatabase?.();
});

describe('handshake', () => {
  it('rejects connections without a valid session cookie', async () => {
    await expect(connectSocket(server.url)).rejects.toThrow('UNAUTHENTICATED');
    await expect(
      connectSocket(server.url, { cookie: 'mt_session=forged.token.value' }),
    ).rejects.toThrow('UNAUTHENTICATED');
  });

  it('rejects connections from origins that are not allowlisted', async () => {
    await expect(
      connectSocket(server.url, { cookie: alice.cookie, origin: 'https://evil.example' }),
    ).rejects.toThrow();
  });
});

describe('board rooms', () => {
  it('only lets workspace members join a board room', async () => {
    const intruder = await open(outsider);
    const denied = await joinBoard(intruder, boardId);
    expect(denied).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Board not found.' },
    });

    const invalid = await joinBoard(intruder, 'not-an-id');
    expect(invalid.ok).toBe(false);

    const member = await open(alice);
    const joined = await joinBoard(member, boardId);
    expect(joined).toEqual({ ok: true, onlineUserIds: [alice.user.id] });
  });

  it('broadcasts presence and keeps multi-tab users online until their last tab leaves', async () => {
    const bobSocket = await open(bob);
    await joinBoard(bobSocket, boardId);

    const aliceTab1 = await open(alice);
    const aliceOnline = nextEvent(bobSocket, 'presence:update');
    await joinBoard(aliceTab1, boardId);
    expect((await aliceOnline).userIds.sort()).toEqual([alice.user.id, bob.user.id].sort());

    const aliceTab2 = await open(alice);
    await joinBoard(aliceTab2, boardId);

    aliceTab1.close();
    expect(await receives(bobSocket, 'presence:update')).toBe(false);

    const aliceOffline = nextEvent(bobSocket, 'presence:update');
    aliceTab2.close();
    expect((await aliceOffline).userIds).toEqual([bob.user.id]);
  });
});

describe('typing indicators', () => {
  it('ignores typing from sockets that have not joined the board', async () => {
    const bobSocket = await open(bob);
    await joinBoard(bobSocket, boardId);
    const aliceSocket = await open(alice);

    aliceSocket.emit('typing:start', { boardId, taskId });
    expect(await receives(bobSocket, 'typing:update')).toBe(false);
  });

  it('relays typing to others and clears it when the typist disconnects', async () => {
    const bobSocket = await open(bob);
    await joinBoard(bobSocket, boardId);
    const aliceSocket = await open(alice);
    await joinBoard(aliceSocket, boardId);

    const started = nextEvent(bobSocket, 'typing:update');
    aliceSocket.emit('typing:start', { boardId, taskId });
    expect(await started).toEqual({
      boardId,
      taskId,
      target: 'task',
      userId: alice.user.id,
      isTyping: true,
    });

    const stopped = nextEvent(bobSocket, 'typing:update');
    aliceSocket.close();
    expect(await stopped).toMatchObject({ userId: alice.user.id, isTyping: false });
  });

  it('relays typing in a comment separately from editing the task', async () => {
    const bobSocket = await open(bob);
    await joinBoard(bobSocket, boardId);
    const aliceSocket = await open(alice);
    await joinBoard(aliceSocket, boardId);

    const commenting = nextEvent(bobSocket, 'typing:update');
    aliceSocket.emit('typing:start', { boardId, taskId, target: 'comment' });
    expect(await commenting).toMatchObject({ taskId, target: 'comment', isTyping: true });

    const stopped = nextEvent(bobSocket, 'typing:update');
    aliceSocket.emit('typing:stop', { boardId, taskId, target: 'comment' });
    expect(await stopped).toMatchObject({ target: 'comment', isTyping: false });
  });
});
