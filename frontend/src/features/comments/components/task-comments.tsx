'use client';

import type { MemberDto } from '@mini-trello/shared';
import { commentBodySchema } from '@mini-trello/shared';
import { MessageSquareIcon } from 'lucide-react';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { formatRelative } from '@/lib/dates';

import { useCreateComment, useTaskComments } from '../hooks/use-comments';
import { flattenComments } from '../lib/comment-pages';

interface TaskCommentsProps {
  taskId: string;
  membersById: Map<string, MemberDto>;
}

export function TaskComments({ taskId, membersById }: TaskCommentsProps) {
  const commentsQuery = useTaskComments(taskId);
  const comments = flattenComments(commentsQuery.data);

  return (
    <section aria-labelledby="task-comments-heading" className="flex flex-col gap-4">
      <h3 id="task-comments-heading" className="flex items-center gap-2 font-medium">
        <MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        Comments
        {comments.length > 0 && (
          <span className="text-muted-foreground tabular-nums">
            {comments.length}
            {commentsQuery.hasNextPage ? '+' : ''}
          </span>
        )}
      </h3>

      {commentsQuery.isPending ? (
        <div className="flex flex-col gap-3" aria-label="Loading comments">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : commentsQuery.isError ? (
        <ErrorState
          title="Could not load comments"
          message={commentsQuery.error.message}
          onRetry={() => void commentsQuery.refetch()}
          isRetrying={commentsQuery.isFetching}
        />
      ) : (
        <>
          {commentsQuery.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => void commentsQuery.fetchNextPage()}
              disabled={commentsQuery.isFetchingNextPage}
            >
              {commentsQuery.isFetchingNextPage ? 'Loading…' : 'Show earlier comments'}
            </Button>
          )}
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet. Start the discussion.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {comments.map((comment) => {
                const name = membersById.get(comment.authorId)?.name ?? 'Former member';
                return (
                  <li key={comment.id} className="flex gap-3">
                    <UserAvatar name={name} className="size-7" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{name}</span>{' '}
                        <time
                          dateTime={comment.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {formatRelative(comment.createdAt)}
                        </time>
                      </p>
                      <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <CommentComposer taskId={taskId} />
    </section>
  );
}

function CommentComposer({ taskId }: { taskId: string }) {
  const createComment = useCreateComment(taskId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();
  // One id per comment, reused if the same comment is retried, so the server can dedupe it.
  const requestId = useRef<string | null>(null);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = commentBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    requestId.current ??= crypto.randomUUID();
    createComment.mutate(
      { body: parsed.data, requestId: requestId.current },
      {
        onSuccess: () => {
          setBody('');
          setError(undefined);
          requestId.current = null;
        },
        onError: (failure) => setError(failure.message),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={`comment-${taskId}`} className="sr-only">
          Add a comment
        </FieldLabel>
        <Textarea
          id={`comment-${taskId}`}
          rows={2}
          placeholder="Write a comment…"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            // Edited text is a different comment: it needs a new request id.
            requestId.current = null;
          }}
          onKeyDown={onKeyDown}
          aria-invalid={!!error}
          aria-describedby={error ? `comment-${taskId}-error` : undefined}
        />
        <FieldError id={`comment-${taskId}-error`} errors={error ? [{ message: error }] : []} />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <p className="hidden text-xs text-muted-foreground sm:block">Ctrl + Enter to post</p>
        <Button type="submit" size="sm" disabled={createComment.isPending}>
          {createComment.isPending ? 'Posting…' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}
