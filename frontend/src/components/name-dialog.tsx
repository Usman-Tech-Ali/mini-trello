'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { applyServerErrors } from '@/lib/forms/apply-server-errors';

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  initialValue?: string;
  /** The `name` field schema shared with the API, e.g. createBoardSchema.shape.name. */
  schema: z.ZodType<string, string>;
  /** Resolves on success (the dialog closes); rejects with an ApiError to show it in the form. */
  onSubmit: (name: string) => Promise<unknown>;
}

/** Small form dialog for creating or renaming something that only has a name. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  initialValue = '',
  schema,
  onSubmit,
}: NameDialogProps) {
  const formSchema = z.object({ name: schema });
  const form = useForm<{ name: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: initialValue },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (open) form.reset({ name: initialValue });
  }, [open, initialValue, form]);

  const submit = form.handleSubmit(async ({ name }) => {
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error) applyServerErrors(error, form.setError, ['name']);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FieldGroup className="py-4">
            <FormError message={errors.root?.server?.message} />
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name-dialog-input">{label}</FieldLabel>
              <Input
                id="name-dialog-input"
                placeholder={placeholder}
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-dialog-error' : undefined}
                {...form.register('name')}
              />
              <FieldError id="name-dialog-error" errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
