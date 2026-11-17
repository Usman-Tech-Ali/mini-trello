import { randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type {
  AuthResponse,
  ClientToServerEvents,
  JoinBoardAck,
  ServerToClientEvents,
  UserDto,
} from '@mini-trello/shared';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';

import { createApp } from '../app';
import { createRealtimeServer } from '../realtime/realtime-server';
import { TEST_ORIGIN, TEST_PASSWORD, uniqueEmail } from './http';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface RealtimeTestServer {
  http: HttpServer;
  url: string;
  close: () => Promise<void>;
}

export async function startRealtimeServer(): Promise<RealtimeTestServer> {
  const http = createServer(createApp());
  const io = createRealtimeServer(http);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const { port } = http.address() as AddressInfo;
  return {
    http,
    url: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        void io.close(() => {
          resolve();
        });
      }),
  };
}

export interface SessionUser {
  user: UserDto;
  cookie: string;
}

/** Registers a user and returns its session cookie, for REST calls and socket handshakes. */
export async function registerSessionUser(http: HttpServer, name: string): Promise<SessionUser> {
  const res = await request(http)
    .post('/api/auth/register')
    .set('Origin', TEST_ORIGIN)
    .send({ name, email: uniqueEmail(name.toLowerCase()), password: TEST_PASSWORD })
    .expect(201);
  const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = setCookie.find((c) => c.startsWith('mt_session='))?.split(';')[0];
  if (!cookie) throw new Error('No session cookie');
  return { user: (res.body as AuthResponse).user, cookie };
}

/** Authenticated REST helper bound to one user. */
export function restAs(http: HttpServer, session: SessionUser, socketId?: string) {
  const withHeaders = (req: request.Test) => {
    req.set('Cookie', session.cookie).set('Origin', TEST_ORIGIN);
    if (socketId) req.set('X-Socket-Id', socketId);
    return req;
  };
  return {
    get: (url: string) => withHeaders(request(http).get(url)),
    post: (url: string) => withHeaders(request(http).post(url)),
    patch: (url: string) => withHeaders(request(http).patch(url)),
    delete: (url: string) => withHeaders(request(http).delete(url)),
  };
}

export function connectSocket(
  url: string,
  options: { cookie?: string; origin?: string } = {},
): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: {
      Origin: options.origin ?? TEST_ORIGIN,
      ...(options.cookie && { Cookie: options.cookie }),
    },
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => {
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

export function joinBoard(socket: ClientSocket, boardId: string): Promise<JoinBoardAck> {
  return new Promise((resolve) => {
    socket.emit('board:join', { boardId }, resolve);
  });
}

export function nextEvent<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  timeoutMs = 2_000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const listener = ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
      clearTimeout(timer);
      resolve(payload);
    }) as ServerToClientEvents[E];
    // socket.io-client's typed `once` cannot express a generic event name.
    (socket.once as (ev: E, fn: ServerToClientEvents[E]) => void)(event, listener);
  });
}

/** Resolves true if `event` arrives within the window, false otherwise. */
export function receives(
  socket: ClientSocket,
  event: keyof ServerToClientEvents,
  windowMs = 300,
): Promise<boolean> {
  return nextEvent(socket, event, windowMs).then(
    () => true,
    () => false,
  );
}

export const newRequestId = () => randomUUID();
