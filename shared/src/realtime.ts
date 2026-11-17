import { z } from 'zod';

import type { ActivityDto } from './activity';
import type { BoardDto } from './boards';
import type { CommentDto } from './comments';
import type { NotificationDto } from './notifications';
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

/** What the user is typing in: the task's fields, or a comment on the task. */
export const typingTargetSchema = z.enum(['task', 'comment']);
export type TypingTarget = z.infer<typeof typingTargetSchema>;

export const typingSignalSchema = z.object({
  boardId: objectIdSchema,
  taskId: objectIdSchema,
  target: typingTargetSchema.default('task'),
});
export type TypingSignalInput = z.input<typeof typingSignalSchema>;

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
  /** A new comment on one of the board's tasks. */
  'comment:created': (payload: { boardId: string; comment: CommentDto }) => void;
  /** Sent to everyone on the board, including the user who caused it. */
  'activity:created': (payload: { boardId: string; activity: ActivityDto }) => void;
  /**
   * Sent to one user (their personal room): they were added to or removed from a workspace, or
   * their role changed. Their workspace list and permissions must be reloaded.
   */
  'workspaces:changed': (payload: { workspaceId: string }) => void;
  /** Sent to the recipient's personal room only. */
  'notification:created': (payload: { notification: NotificationDto }) => void;
  /** Notifications were marked read (possibly in another tab): reload the list and count. */
  'notifications:changed': () => void;
  'presence:update': (payload: { boardId: string; userIds: string[] }) => void;
  'typing:update': (payload: {
    boardId: string;
    taskId: string;
    target: TypingTarget;
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
