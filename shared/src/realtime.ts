import { z } from 'zod';

import type { BoardDto } from './boards';
import { objectIdSchema } from './common';
import type { ErrorCode } from './errors';
import type { TaskDto } from './tasks';

/**
 * Socket.IO contract. Changes are made through the REST API; after the database write commits,
 * the server broadcasts them to the board's room. Clients only send presence/typing signals.
 */

/** REST requests carry the sender's socket id so the server can skip echoing changes back to it. */
export const SOCKET_ID_HEADER = 'x-socket-id';

export const boardChannelSchema = z.object({ boardId: objectIdSchema });
export type BoardChannelInput = z.infer<typeof boardChannelSchema>;

export const typingSignalSchema = z.object({ boardId: objectIdSchema, taskId: objectIdSchema });
export type TypingSignalInput = z.infer<typeof typingSignalSchema>;

export interface SocketFailure {
  ok: false;
  error: { code: ErrorCode; message: string };
}

export type SocketAck<T = object> = ({ ok: true } & T) | SocketFailure;

export type JoinBoardAck = SocketAck<{ onlineUserIds: string[] }>;

export interface ServerToClientEvents {
  'task:created': (payload: { boardId: string; task: TaskDto }) => void;
  /** Field edits and moves. Clients ignore payloads older than their cached version. */
  'task:updated': (payload: { boardId: string; task: TaskDto }) => void;
  'task:deleted': (payload: { boardId: string; taskId: string }) => void;
  /** Rename or any column change; carries the whole board (columns included). */
  'board:updated': (payload: { board: BoardDto }) => void;
  'board:deleted': (payload: { boardId: string }) => void;
  /** Many tasks changed at once (e.g. a member was removed and unassigned): refetch. */
  'board:stale': (payload: { boardId: string }) => void;
  /** The user lost access (removed from the workspace) and has been taken out of the room. */
  'board:access-revoked': (payload: { boardId: string }) => void;
  'presence:update': (payload: { boardId: string; userIds: string[] }) => void;
  'typing:update': (payload: {
    boardId: string;
    taskId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
}

export interface ClientToServerEvents {
  'board:join': (payload: BoardChannelInput, ack: (result: JoinBoardAck) => void) => void;
  'board:leave': (payload: BoardChannelInput) => void;
  'typing:start': (payload: TypingSignalInput) => void;
  'typing:stop': (payload: TypingSignalInput) => void;
}
