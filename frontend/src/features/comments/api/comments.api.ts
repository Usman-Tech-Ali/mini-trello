import type {
  CommentDto,
  CommentListResponse,
  CommentResponse,
  CreateCommentInput,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function listComments(
  taskId: string,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<CommentListResponse> {
  const query = cursor ? `?cursor=${cursor}` : '';
  return apiRequest<CommentListResponse>(`/api/tasks/${taskId}/comments${query}`, { signal });
}

export async function createComment(
  taskId: string,
  input: CreateCommentInput,
): Promise<CommentDto> {
  const { comment } = await apiRequest<CommentResponse>(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: input,
  });
  return comment;
}
