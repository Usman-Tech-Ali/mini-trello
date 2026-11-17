import type { BoardDto, ServerToClientEvents, TaskDto } from '@mini-trello/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { activityKeys } from '@/features/activity/api/activity.keys';
import { addActivity, type ActivityPages } from '@/features/activity/lib/activity-pages';
import { boardKeys } from '@/features/boards/api/boards.keys';
import { commentKeys } from '@/features/comments/api/comments.keys';
import { addComment, type CommentPages } from '@/features/comments/lib/comment-pages';
import { taskKeys } from '@/features/tasks/api/tasks.keys';
import { workspaceKeys } from '@/features/workspaces/api/workspaces.keys';
import { getSocket } from '@/lib/realtime/socket';

import {
  applyTyping,
  pruneTyping,
  removeRemoteTask,
  upsertRemoteTask,
  type TypingState,
} from '../lib/remote-updates';

type Payload<E extends keyof ServerToClientEvents> = Parameters<ServerToClientEvents[E]>[0];

interface BoardChannelOptions {
  /** Called when someone else deletes a task (e.g. to close it if it's open). */
  onTaskDeleted?: (taskId: string) => void;
}

/**
 * Joins the board's live room and keeps the TanStack Query cache in sync with other users'
 * changes. Rejoins after every reconnect. Returns who is online and who is typing where.
 */
export function useBoardChannel(
  board: Pick<BoardDto, 'id' | 'workspaceId'>,
  { onTaskDeleted }: BoardChannelOptions = {},
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typing, setTyping] = useState<TypingState>(new Map());
  // Latest callback without re-subscribing to the socket on every render.
  const onTaskDeletedRef = useRef(onTaskDeleted);
  useEffect(() => {
    onTaskDeletedRef.current = onTaskDeleted;
  });

  useEffect(() => {
    const socket = getSocket();
    const boardId = board.id;
    const tasksKey = taskKeys.board(boardId);
    const forThisBoard = (payload: { boardId: string }) => payload.boardId === boardId;

    const join = () => {
      socket.emit('board:join', { boardId }, (result) => {
        if (result.ok) setOnlineUserIds(result.onlineUserIds);
      });
    };
    const onTaskChanged = (payload: Payload<'task:updated'>) => {
      if (!forThisBoard(payload)) return;
      queryClient.setQueryData<TaskDto[]>(tasksKey, (tasks = []) =>
        upsertRemoteTask(tasks, payload.task),
      );
    };
    const onTaskDeleted = (payload: Payload<'task:deleted'>) => {
      if (!forThisBoard(payload)) return;
      queryClient.setQueryData<TaskDto[]>(tasksKey, (tasks = []) =>
        removeRemoteTask(tasks, payload.taskId),
      );
      onTaskDeletedRef.current?.(payload.taskId);
    };
    const onBoardUpdated = ({ board: updated }: Payload<'board:updated'>) => {
      if (updated.id !== boardId) return;
      queryClient.setQueryData(boardKeys.detail(boardId), updated);
      void queryClient.invalidateQueries({ queryKey: boardKeys.list(updated.workspaceId) });
    };
    const onBoardStale = (payload: Payload<'board:stale'>) => {
      if (forThisBoard(payload)) void queryClient.invalidateQueries({ queryKey: tasksKey });
    };
    const onBoardDeleted = (payload: Payload<'board:deleted'>) => {
      if (!forThisBoard(payload)) return;
      toast.info('This board was deleted by an admin.');
      queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: boardKeys.list(board.workspaceId) });
      router.replace(`/workspaces/${board.workspaceId}`);
    };
    const onAccessRevoked = (payload: Payload<'board:access-revoked'>) => {
      if (!forThisBoard(payload)) return;
      toast.error('You were removed from this workspace.');
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      router.replace('/workspaces');
    };
    const onComment = ({ boardId: eventBoardId, comment }: Payload<'comment:created'>) => {
      if (eventBoardId !== boardId) return;
      queryClient.setQueryData<CommentPages>(commentKeys.task(comment.taskId), (data) =>
        addComment(data, comment),
      );
    };
    const onActivity = (payload: Payload<'activity:created'>) => {
      if (!forThisBoard(payload)) return;
      queryClient.setQueryData<ActivityPages>(activityKeys.board(boardId), (data) =>
        addActivity(data, payload.activity),
      );
    };
    const onPresence = (payload: Payload<'presence:update'>) => {
      if (forThisBoard(payload)) setOnlineUserIds(payload.userIds);
    };
    const onTyping = (payload: Payload<'typing:update'>) => {
      if (forThisBoard(payload)) setTyping((state) => applyTyping(state, payload, Date.now()));
    };

    socket.on('connect', join);
    socket.on('task:created', onTaskChanged);
    socket.on('task:updated', onTaskChanged);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('board:updated', onBoardUpdated);
    socket.on('board:stale', onBoardStale);
    socket.on('board:deleted', onBoardDeleted);
    socket.on('board:access-revoked', onAccessRevoked);
    socket.on('comment:created', onComment);
    socket.on('activity:created', onActivity);
    socket.on('presence:update', onPresence);
    socket.on('typing:update', onTyping);
    if (socket.connected) join();

    const pruneTimer = setInterval(() => {
      setTyping((state) => pruneTyping(state, Date.now()));
    }, 1_000);

    return () => {
      clearInterval(pruneTimer);
      socket.emit('board:leave', { boardId });
      socket.off('connect', join);
      socket.off('task:created', onTaskChanged);
      socket.off('task:updated', onTaskChanged);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('board:updated', onBoardUpdated);
      socket.off('board:stale', onBoardStale);
      socket.off('board:deleted', onBoardDeleted);
      socket.off('board:access-revoked', onAccessRevoked);
      socket.off('comment:created', onComment);
      socket.off('activity:created', onActivity);
      socket.off('presence:update', onPresence);
      socket.off('typing:update', onTyping);
    };
  }, [board.id, board.workspaceId, queryClient, router]);

  return { onlineUserIds, typing };
}
