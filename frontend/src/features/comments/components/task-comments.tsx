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
import { cn } from '@/lib/utils';

import { useCreateComment, useTaskComments } from '../hooks/use-comments';
import { flattenComments } from '../lib/comment-pages';
import {
  activeMentionQuery,
  insertMention,
  matchMembers,
  splitMentions,
  type MentionQuery,
} from '../lib/mentions';

interface TaskCommentsProps {
  taskId: string;
  membersById: Map<string, MemberDto>;
  currentUserId: string;
}

export function TaskComments({ taskId, membersById, currentUserId }: TaskCommentsProps) {
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
                      <CommentBody
                        body={comment.body}
                        names={comment.mentionIds.flatMap((id) => membersById.get(id)?.name ?? [])}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      <CommentComposer
        taskId={taskId}
        mentionable={[...membersById.values()].filter((m) => m.userId !== currentUserId)}
      />
    </section>
  );
}

interface CommentComposerProps {
  taskId: string;
  /** People who can be @mentioned (the author is excluded). */
  mentionable: MemberDto[];
}

function CommentComposer({ taskId, mentionable }: CommentComposerProps) {
  const createComment = useCreateComment(taskId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>();
  // One id per comment, reused if the same comment is retried, so the server can dedupe it.
  const requestId = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Picked from the list: userId → name. Only those whose "@Name" survives in the text count.
  const [picked, setPicked] = useState<ReadonlyMap<string, string>>(new Map());
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = mention ? matchMembers(mentionable, mention.query) : [];
  const suggesting = suggestions.length > 0;
  const listId = `mention-list-${taskId}`;
  const optionId = (index: number) => `${listId}-${index}`;

  const updateMention = (text: string, caret: number) => {
    setMention(activeMentionQuery(text, caret));
    setActiveIndex(0);
  };

  const choose = (member: MemberDto) => {
    const textarea = textareaRef.current;
    if (!mention || !textarea) return;
    const next = insertMention(body, mention, textarea.selectionStart, member.name);
    setBody(next.text);
    setPicked((current) => new Map(current).set(member.userId, member.name));
    setMention(null);
    requestId.current = null;
    // Restore the caret after React re-renders the new text.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const parsed = commentBodySchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    const mentionIds = [...picked]
      .filter(([, name]) => parsed.data.includes(`@${name}`))
      .map(([userId]) => userId);
    requestId.current ??= crypto.randomUUID();
    createComment.mutate(
      { body: parsed.data, mentionIds, requestId: requestId.current },
      {
        onSuccess: () => {
          setBody('');
          setPicked(new Map());
          setError(undefined);
          requestId.current = null;
        },
        onError: (failure) => setError(failure.message),
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggesting) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const member = suggestions[activeIndex];
        if (member) choose(member);
        return;
      }
      if (event.key === 'Escape') {
        // The task dialog checks data-suggesting, so Escape closes only the list.
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <Field data-invalid={!!error} className="relative">
        <FieldLabel htmlFor={`comment-${taskId}`} className="sr-only">
          Add a comment
        </FieldLabel>
        <Textarea
          ref={textareaRef}
          id={`comment-${taskId}`}
          rows={2}
          placeholder="Write a comment… Type @ to mention someone"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            updateMention(event.target.value, event.target.selectionStart);
            // Edited text is a different comment: it needs a new request id.
            requestId.current = null;
          }}
          onSelect={(event) =>
            updateMention(event.currentTarget.value, event.currentTarget.selectionStart)
          }
          onBlur={() => setMention(null)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggesting}
          aria-controls={listId}
          aria-activedescendant={suggesting ? optionId(activeIndex) : undefined}
          data-suggesting={suggesting || undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `comment-${taskId}-error` : undefined}
        />
        {suggesting && (
          <ul
            id={listId}
            role="listbox"
            aria-label="People to mention"
            className="absolute top-full left-0 z-10 mt-1 w-64 overflow-hidden rounded-md border bg-popover p-1 shadow-md"
          >
            {suggestions.map((member, index) => (
              <li
                key={member.userId}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // Keep focus in the textarea; choose on press, before blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(member);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm',
                  index === activeIndex && 'bg-accent text-accent-foreground',
                )}
              >
                <UserAvatar name={member.name} className="size-5 text-[10px]" />
                <span className="truncate">{member.name}</span>
              </li>
            ))}
          </ul>
        )}
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

function CommentBody({ body, names }: { body: string; names: string[] }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {splitMentions(body, names).map((segment, index) =>
        segment.mention ? (
          <span key={index} className="font-medium text-primary">
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </p>
  );
}
