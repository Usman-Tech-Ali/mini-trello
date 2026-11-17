import type { ClientToServerEvents, ServerToClientEvents } from '@mini-trello/shared';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/config/env';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: RealtimeSocket | null = null;

/** One socket per browser tab. Authenticated by the httpOnly session cookie on the handshake. */
export function getSocket(): RealtimeSocket {
  socket ??= io(env.apiUrl, { withCredentials: true, autoConnect: false });
  return socket;
}

/** Sent with REST requests so the server doesn't echo our own changes back to us. */
export function getSocketId(): string | undefined {
  return socket?.connected ? socket.id : undefined;
}
