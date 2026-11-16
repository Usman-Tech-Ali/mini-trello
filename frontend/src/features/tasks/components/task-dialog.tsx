'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { BoardDto, MemberDto, TaskDto, UpdateTaskInput } from '@mini-trello/shared';
import { taskDescriptionSchema, taskPrioritySchema, taskTitleSchema } from '@mini-trello/shared';
import { Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { FormError } from '@/components/feedback/form-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/api-error';
import { formatDate, formatRelative } from '@/lib/dates';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';

import { useDeleteTask, useMoveTask, useUpdateTask } from '../hooks/use-tasks';
import { PRIORITIES, priorityConfig } from '../lib/priority';

const UNASSIGNED = 'unassigned';

const formSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  columnId: z.string(),
  priority: taskPrioritySchema,
  assigneeId: z.string(),
  // "" from an empty <input type="date"> means no due date.
  dueDate: z.union([z.literal(''), z.iso.date('Enter a valid date')]),
});
type FormValues = z.input<typeof formSchema>;

function toFormValues(task: TaskDto): FormValues {
  return {
    title: task.title,
    description: task.description,
    columnId: task.columnId,
    priority: task.priority,
    assigneeId: task.assigneeId ?? UNASSIGNED,
    dueDate: task.dueDate ?? '',
  };
}

interface TaskDialogProps {
  task: TaskDto | null;
  board: BoardDto;
  members: MemberDto[];
  /** Number of tasks per column, used to append when the status changes. */
  columnSizes: Map<string, number>;
  onClose: () => void;
}

export function TaskDialog({ task, board, members, columnSizes, onClose }: TaskDialogProps) {
  const updateTask = useUpdateTask(board.id);
  const moveTask = useMoveTask(board.id);
  const deleteTask = useDeleteTask(board.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflict, setConflict] = useState(false);
  const form = useForm<FormValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: task ? toFormValues(task) : undefined,
  });
  const { errors, isSubmitting } = form.formState;

  const taskId = task?.id;
  const version = task?.version;
  // After a conflict the newer server version arrives: load it into the form for review.
  // (The parent keys this dialog by task id, so opening another task starts fresh.)
  useEffect(() => {
    if (task) form.reset(toFormValues(task));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a different task/version arrives
  }, [taskId, version]);

  if (!task) return null;

  const creator = members.find((m) => m.userId === task.creatorId);

  const save = form.handleSubmit(async (values) => {
    const changes: Omit<UpdateTaskInput, 'version'> = {};
    if (values.title !== task.title) changes.title = values.title;
    if (values.description !== task.description) changes.description = values.description;
    if (values.priority !== task.priority) changes.priority = values.priority;
    const assigneeId = values.assigneeId === UNASSIGNED ? null : values.assigneeId;
    if (assigneeId !== task.assigneeId) changes.assigneeId = assigneeId;
    const dueDate = values.dueDate || null;
    if (dueDate !== task.dueDate) changes.dueDate = dueDate;

    try {
      let current = task;
      if (Object.keys(changes).length > 0) {
        current = await updateTask.mutateAsync({
          taskId: task.id,
          input: { version: current.version, ...changes },
        });
      }
      if (values.columnId !== task.columnId) {
        await moveTask.mutateAsync({
          task: current,
          columnId: values.columnId,
          index: columnSizes.get(values.columnId) ?? 0,
        });
      }
      toast.success('Task saved');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        setConflict(true);
        return;
      }
      if (error instanceof Error) {
        applyServerErrors(error, form.setError, ['title', 'description', 'assigneeId', 'dueDate']);
      }
    }
  });

  const confirmDeletion = () => {
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast.success('Task deleted');
        setConfirmDelete(false);
        onClose();
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error(error.message);
      },
    });
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={(event) => void save(event)} noValidate>
            <DialogHeader>
              <DialogTitle>Edit task</DialogTitle>
              <DialogDescription>
                Created {formatDate(task.createdAt)}
                {creator ? ` by ${creator.name}` : ''} · updated {formatRelative(task.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4 sm:grid-cols-[1fr_200px]">
              <FieldGroup>
                {conflict && (
                  <FormError message="Someone else changed this task while you were editing. The latest version is loaded below — review it and save again." />
                )}
                <FormError message={errors.root?.server?.message} />
                <Field data-invalid={!!errors.title}>
                  <FieldLabel htmlFor="task-title">Title</FieldLabel>
                  <Input
                    id="task-title"
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'task-title-error' : undefined}
                    {...form.register('title')}
                  />
                  <FieldError id="task-title-error" errors={[errors.title]} />
                </Field>
                <Field data-invalid={!!errors.description}>
                  <FieldLabel htmlFor="task-description">Description</FieldLabel>
                  <Textarea
                    id="task-description"
                    rows={8}
                    placeholder="Add more detail…"
                    aria-invalid={!!errors.description}
                    aria-describedby={errors.description ? 'task-description-error' : undefined}
                    {...form.register('description')}
                  />
                  <FieldError id="task-description-error" errors={[errors.description]} />
                </Field>
              </FieldGroup>

              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="task-status">Status</FieldLabel>
                  <Controller
                    control={form.control}
                    name="columnId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="task-status" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {board.columns.map((column) => (
                            <SelectItem key={column.id} value={column.id}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                  <Controller
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="task-priority" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priorityConfig[priority].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field data-invalid={!!errors.assigneeId}>
                  <FieldLabel htmlFor="task-assignee">Assignee</FieldLabel>
                  <Controller
                    control={form.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="task-assignee" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.userId} value={member.userId}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError errors={[errors.assigneeId]} />
                </Field>
                <Field data-invalid={!!errors.dueDate}>
                  <FieldLabel htmlFor="task-due">Due date</FieldLabel>
                  <Input
                    id="task-due"
                    type="date"
                    aria-invalid={!!errors.dueDate}
                    {...form.register('dueDate')}
                  />
                  <FieldError errors={[errors.dueDate]} />
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden="true" />
                Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={`“${task.title}” will be permanently deleted.`}
        confirmLabel="Delete task"
        onConfirm={confirmDeletion}
        isPending={deleteTask.isPending}
      />
    </>
  );
}
