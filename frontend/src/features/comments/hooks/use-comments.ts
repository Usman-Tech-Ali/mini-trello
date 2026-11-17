import type { CreateCommentInput } from '@mini-trello/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { createComment, listComments } from '../api/comments.api';
import { commentKeys } from '../api/comments.keys';
import { addComment, type CommentPages } from '../lib/comment-pages';

/** A task's comments, newest page first; `fetchNextPage` loads earlier comments. */
export function useTaskComments(taskId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.task(taskId),
    queryFn: ({ pageParam, signal }) => listComments(taskId, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(taskId, input),
    onSuccess: (comment) => {
      queryClient.setQueryData<CommentPages>(commentKeys.task(taskId), (data) =>
        addComment(data, comment),
      );
    },
  });
}
