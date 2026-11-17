'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { setSession } from '@/features/auth/hooks/use-session';
import { getSocket } from '@/lib/realtime/socket';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

const ConnectionStatusContext = createContext<ConnectionStatus>('connecting');

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionStatusContext);
}

/**
 * Owns the socket for the signed-in part of the app: connects on mount, disconnects on sign-out
 * (unmount), and after any reconnect refetches everything so missed events can't leave stale data.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const socket = getSocket();
    let connectedBefore = false;

    const onConnect = () => {
      // Reconcile: anything could have changed while we were disconnected.
      if (connectedBefore) void queryClient.invalidateQueries();
      connectedBefore = true;
      setStatus('connected');
    };
    const onDisconnect = (reason: string) => {
      // The client retries on its own unless we or the server closed the connection on purpose.
      setStatus(
        socket.active
          ? 'reconnecting'
          : reason === 'io client disconnect'
            ? 'connecting'
            : 'offline',
      );
    };
    const onConnectError = (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') setSession(queryClient, null);
      else setStatus(socket.active ? 'reconnecting' : 'offline');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <ConnectionStatusContext.Provider value={status}>{children}</ConnectionStatusContext.Provider>
  );
}
