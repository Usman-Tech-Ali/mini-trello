'use client';

import { PlusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useCreateTask } from '../hooks/use-tasks';

const MAX_TITLE = 200;

/** Inline "add a card" composer at the bottom of a column. Enter adds, Escape closes. */
export function TaskComposer({ boardId, columnId }: { boardId: string; columnId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  // One id per draft: a retried submit of the same draft can't create a duplicate task.
  const requestId = useRef(crypto.randomUUID());
  const createTask = useCreateTask(boardId);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || createTask.isPending) return;
    createTask.mutate(
      { title: trimmed, columnId, requestId: requestId.current },
      {
        onSuccess: () => {
          setTitle('');
          requestId.current = crypto.randomUUID();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" />
        Add task
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        autoFocus
        aria-label="Task title"
        placeholder="What needs to be done?"
        maxLength={MAX_TITLE}
        rows={2}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') setOpen(false);
        }}
        className="min-h-0 resize-none bg-card text-sm"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!title.trim() || createTask.isPending}>
          {createTask.isPending ? 'Adding…' : 'Add task'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
