import { useCallback, useEffect, useRef } from 'react';

import { getSocket } from '@/lib/realtime/socket';

const RESEND_MS = 2_000;
const IDLE_MS = 3_000;

/**
 * Tells others on the board that the user is editing a task. Call `onActivity` on each keystroke:
 * a start signal is sent at most every 2 s, and a stop signal after 3 s idle, on `stop()`, or on
 * unmount. (Receivers also expire indicators on their own.)
 */
export function useTypingSignal(boardId: string, taskId: string | undefined) {
  const lastSentAt = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);

  const stop = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (!active.current || !taskId) return;
    active.current = false;
    lastSentAt.current = 0;
    getSocket().emit('typing:stop', { boardId, taskId });
  }, [boardId, taskId]);

  const onActivity = useCallback(() => {
    if (!taskId) return;
    const now = Date.now();
    if (now - lastSentAt.current > RESEND_MS) {
      getSocket().emit('typing:start', { boardId, taskId });
      lastSentAt.current = now;
      active.current = true;
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(stop, IDLE_MS);
  }, [boardId, taskId, stop]);

  useEffect(() => stop, [stop]);

  return { onActivity, stop };
}
