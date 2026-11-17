import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketTicketResponse,
} from '@mini-trello/shared';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/config/env';
import { apiRequest } from '@/lib/api/client';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: RealtimeSocket | null = null;

/**
 * One socket per browser tab. Before every (re)connect it fetches a one-minute ticket over REST,
 * where the session cookie is sent, and passes it in the handshake. The socket talks to the API
 * host directly, which may be a different site than this app (whose cookie it then can't send).
 */
export function getSocket(): RealtimeSocket {
  socket ??= io(env.apiUrl, {
    withCredentials: true,
    autoConnect: false,
    auth: (send) => {
      apiRequest<SocketTicketResponse>('/api/auth/socket-ticket', { method: 'POST' }).then(
        ({ token }) => send({ token }),
        // No ticket: the server falls back to the cookie, or rejects with UNAUTHENTICATED.
        () => send({}),
      );
    },
  });
  return socket;
}

/** Sent with REST requests so the server doesn't echo our own changes back to us. */
export function getSocketId(): string | undefined {
  return socket?.connected ? socket.id : undefined;
}
