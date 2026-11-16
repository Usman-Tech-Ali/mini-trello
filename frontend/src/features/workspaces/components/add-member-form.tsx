'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { addMemberSchema } from '@mini-trello/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';

import { useAddMember } from '../hooks/use-workspaces';

export function AddMemberForm({ workspaceId }: { workspaceId: string }) {
  const addMember = useAddMember(workspaceId);
  const form = useForm<z.input<typeof addMemberSchema>, unknown, z.output<typeof addMemberSchema>>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const emailError = errors.email ?? errors.root?.server;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const member = await addMember.mutateAsync(values);
      toast.success(`${member.name} was added to the workspace`);
      form.reset();
    } catch (error) {
      if (error instanceof Error) applyServerErrors(error, form.setError, ['email']);
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <Field data-invalid={!!emailError}>
        <FieldLabel htmlFor="member-email">Add a member by email</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="member-email"
            type="email"
            placeholder="teammate@example.com"
            autoComplete="off"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'member-email-error' : undefined}
            {...form.register('email')}
          />
          <Button type="submit" disabled={isSubmitting} className="sm:w-28">
            {isSubmitting ? 'Adding…' : 'Add member'}
          </Button>
        </div>
        <FieldError id="member-email-error" errors={[emailError]} />
      </Field>
    </form>
  );
}
