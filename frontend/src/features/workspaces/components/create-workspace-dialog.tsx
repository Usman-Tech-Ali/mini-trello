'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createWorkspaceSchema } from '@mini-trello/shared';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { FormError } from '@/components/feedback/form-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';

import { useCreateWorkspace } from '../hooks/use-workspaces';

const formSchema = createWorkspaceSchema.pick({ name: true });

export function CreateWorkspaceDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  // One id per dialog session: a retried submit reuses it, so the server can't create duplicates.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const router = useRouter();
  const createWorkspace = useCreateWorkspace();
  const form = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      form.reset();
      setRequestId(crypto.randomUUID());
    }
  };

  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      const workspace = await createWorkspace.mutateAsync({ name, requestId });
      toast.success(`Created “${workspace.name}”`);
      setOpen(false);
      router.push(`/workspaces/${workspace.id}`);
    } catch (error) {
      if (error instanceof Error) applyServerErrors(error, form.setError, ['name']);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              A workspace holds your team’s boards. You’ll be its admin.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <FormError message={errors.root?.server?.message} />
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
              <Input
                id="workspace-name"
                placeholder="e.g. Product Team"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'workspace-name-error' : undefined}
                {...form.register('name')}
              />
              <FieldError id="workspace-name-error" errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
