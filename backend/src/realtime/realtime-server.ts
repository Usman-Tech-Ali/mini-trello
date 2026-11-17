import type { Server as HttpServer } from 'node:http';

import type {
  ActivityDto,
  ClientToServerEvents,
  NotificationDto,
  ErrorCode,
  ServerToClientEvents,
  SocketFailure,
  TypingTarget,
} from '@mini-trello/shared';
import { boardChannelSchema, typingSignalSchema } from '@mini-trello/shared';
import { parse as parseCookies } from 'cookie';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';

import { config } from '../config/env';
import { AppError } from '../lib/app-error';
import { logger } from '../lib/logger';
import { assertBoardAccess } from '../modules/boards/board-access';
import { SESSION_COOKIE, verifySession, verifySocketTicket } from '../modules/auth/session';
import { TaskModel } from '../modules/tasks/task.model';
import { PresenceTracker } from './presence';

interface SocketData {
  userId: string;
  /** Unix seconds; the socket is dropped once the session it was opened with expires. */
  sessionExpiresAt: number;
  /** Joined boards → their workspace, so access can be revoked per workspace. */
  boards: Map<string, string>;
  /** `boardId|taskId|target` keys this socket is currently typing in. */
  typing: Set<string>;
  /** `boardId|taskId` pairs already checked against the database (typing spam stays cheap). */
  verifiedTasks: Set<string>;
}

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const log = logger.child({ source: 'realtime' });
const presence = new PresenceTracker();
let io: RealtimeServer | null = null;

const boardRoom = (boardId: string) => `board:${boardId}`;
/** Every socket of a user, for events about them personally (not about a board). */
const userRoom = (userId: string) => `user:${userId}`;

function errorAck(error: unknown): SocketFailure {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  log.error({ err: error }, 'Unhandled socket error');
  const code: ErrorCode = 'INTERNAL_ERROR';
  return { ok: false, error: { code, message: 'Something went wrong. Please try again.' } };
}

function parsePayload<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid payload.');
  return result.data;
}

/** Sessions can expire while a socket stays open; such sockets are disconnected. */
function sessionIsValid(socket: RealtimeSocket): boolean {
  if (Date.now() < socket.data.sessionExpiresAt * 1000) return true;
  socket.disconnect(true);
  return false;
}

function broadcastPresence(boardId: string): void {
  io?.to(boardRoom(boardId)).emit('presence:update', {
    boardId,
    userIds: presence.usersOn(boardId),
  });
}

const typingKey = (boardId: string, taskId: string, target: TypingTarget) =>
  `${boardId}|${taskId}|${target}`;

function stopTyping(
  socket: RealtimeSocket,
  boardId: string,
  taskId: string,
  target: TypingTarget,
): void {
  if (!socket.data.typing.delete(typingKey(boardId, taskId, target))) return;
  socket.to(boardRoom(boardId)).emit('typing:update', {
    boardId,
    taskId,
    target,
    userId: socket.data.userId,
    isTyping: false,
  });
}

function leaveBoard(socket: RealtimeSocket, boardId: string): void {
  if (!socket.data.boards.delete(boardId)) return;
  for (const key of [...socket.data.typing]) {
    const [typingBoardId, taskId, target] = key.split('|');
    if (typingBoardId === boardId && taskId && (target === 'task' || target === 'comment')) {
      stopTyping(socket, boardId, taskId, target);
    }
  }
  for (const key of [...socket.data.verifiedTasks]) {
    if (key.startsWith(`${boardId}|`)) socket.data.verifiedTasks.delete(key);
  }
  void socket.leave(boardRoom(boardId));
  if (presence.leave(boardId, socket.data.userId, socket.id)) broadcastPresence(boardId);
}

function registerHandlers(socket: RealtimeSocket): void {
  socket.on('board:join', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => undefined;
    if (!sessionIsValid(socket)) return;
    try {
      const { boardId } = parsePayload(boardChannelSchema, payload);
      // Same authorization as the REST API: only members of the board's workspace may join.
      const access = await assertBoardAccess(socket.data.userId, boardId);
      // One board per socket (one per tab): leave any previous board first.
      for (const joined of [...socket.data.boards.keys()]) {
        if (joined !== boardId) leaveBoard(socket, joined);
      }
      await socket.join(boardRoom(boardId));
      socket.data.boards.set(boardId, access.workspaceId);
      if (presence.join(boardId, socket.data.userId, socket.id)) broadcastPresence(boardId);
      reply({ ok: true, onlineUserIds: presence.usersOn(boardId) });
    } catch (error) {
      reply(errorAck(error));
    }
  });

  socket.on('board:leave', (payload) => {
    const result = boardChannelSchema.safeParse(payload);
    if (result.success) leaveBoard(socket, result.data.boardId);
  });

  socket.on('typing:start', async (payload) => {
    if (!sessionIsValid(socket)) return;
    const result = typingSignalSchema.safeParse(payload);
    if (!result.success) return;
    const { boardId, taskId, target } = result.data;
    const key = typingKey(boardId, taskId, target);
    // Only from a board this socket was authorized to join, and only for that board's tasks.
    if (!socket.data.boards.has(boardId) || socket.data.typing.has(key)) return;
    const taskKey = `${boardId}|${taskId}`;
    if (!socket.data.verifiedTasks.has(taskKey)) {
      if (!(await TaskModel.exists({ _id: taskId, boardId }))) return;
      socket.data.verifiedTasks.add(taskKey);
    }
    socket.data.typing.add(key);
    socket.to(boardRoom(boardId)).emit('typing:update', {
      boardId,
      taskId,
      target,
      userId: socket.data.userId,
      isTyping: true,
    });
  });

  socket.on('typing:stop', (payload) => {
    const result = typingSignalSchema.safeParse(payload);
    if (result.success) {
      const { boardId, taskId, target } = result.data;
      stopTyping(socket, boardId, taskId, target);
    }
  });

  socket.on('disconnect', () => {
    for (const boardId of [...socket.data.boards.keys()]) leaveBoard(socket, boardId);
  });
}

export function createRealtimeServer(httpServer: HttpServer): RealtimeServer {
  const allowedOrigins = new Set(config.corsOrigins);
  const server: RealtimeServer = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    // CORS does not protect WebSockets, so the handshake origin is checked explicitly.
    allowRequest: (req, callback) => {
      callback(null, allowedOrigins.has(req.headers.origin ?? ''));
    },
  });

  // Authenticate the handshake with a socket ticket (`auth: { token }`), or else with the same
  // httpOnly session cookie as the REST API (when the web app and API share a site).
  server.use((socket, next) => {
    const auth: unknown = socket.handshake.auth;
    const ticket =
      typeof auth === 'object' && auth !== null && 'token' in auth && typeof auth.token === 'string'
        ? auth.token
        : undefined;
    const cookie = parseCookies(socket.request.headers.cookie ?? '')[SESSION_COOKIE];
    const verified = ticket
      ? verifySocketTicket(ticket)
      : cookie
        ? verifySession(cookie)
        : Promise.resolve(null);
    void verified.then((session) => {
      if (!session) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }
      socket.data = {
        userId: session.userId,
        sessionExpiresAt: session.expiresAt,
        boards: new Map(),
        typing: new Set(),
        verifiedTasks: new Set(),
      };
      next();
    });
  });

  server.on('connection', (socket) => {
    // Derived from the verified session, never from client input.
    void socket.join(userRoom(socket.data.userId));
    registerHandlers(socket);
  });
  io = server;
  return server;
}

// ---- Called by REST controllers, only after the database write has committed ----

export function emitToBoard<E extends keyof ServerToClientEvents>(
  boardId: string,
  exceptSocketId: string | undefined,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  if (!io) return;
  const target = exceptSocketId
    ? io.to(boardRoom(boardId)).except(exceptSocketId)
    : io.to(boardRoom(boardId));
  target.emit(event, ...args);
}

export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  io?.to(userRoom(userId)).emit(event, ...args);
}

/** Delivers each notification to its recipient's open tabs (after the write committed). */
export function emitNotifications(sent: { userId: string; notification: NotificationDto }[]): void {
  for (const { userId, notification } of sent) {
    emitToUser(userId, 'notification:created', { notification });
  }
}

/** The board was deleted: tell everyone on it and empty the room. */
export function closeBoardRoom(boardId: string): void {
  if (!io) return;
  io.to(boardRoom(boardId)).emit('board:deleted', { boardId });
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.boards.delete(boardId)) void socket.leave(boardRoom(boardId));
  }
  presence.clearBoard(boardId);
}

/** A user was removed from a workspace: take their sockets out of that workspace's boards. */
export function revokeWorkspaceAccess(workspaceId: string, userId: string): void {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.userId !== userId) continue;
    for (const [boardId, boardWorkspaceId] of [...socket.data.boards]) {
      if (boardWorkspaceId !== workspaceId) continue;
      leaveBoard(socket, boardId);
      socket.emit('board:access-revoked', { boardId });
    }
  }
}

/** Activity goes to everyone on the board, the actor included (their feed updates the same way). */
export function emitActivity(activities: ActivityDto[]): void {
  for (const activity of activities) {
    emitToBoard(activity.boardId, undefined, 'activity:created', {
      boardId: activity.boardId,
      activity,
    });
  }
}
