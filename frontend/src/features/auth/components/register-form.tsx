'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@mini-trello/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FormError } from '@/components/feedback/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';

import { useRegister } from '../hooks/use-auth-mutations';
import { AuthCard } from './auth-card';

type RegisterFormValues = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const registerUser = useRegister();
  const form = useForm<RegisterFormValues, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      router.replace('/workspaces');
    } catch (error) {
      if (error instanceof Error) {
        applyServerErrors(error, form.setError, ['name', 'email', 'password']);
      }
    }
  });

  return (
    <AuthCard
      title="Create your account"
      description="Start organizing work with your team."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          <FormError message={errors.root?.server?.message} />
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              {...form.register('name')}
            />
            <FieldError id="name-error" errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...form.register('email')}
            />
            <FieldError id="email-error" errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : 'password-hint'}
              {...form.register('password')}
            />
            {errors.password ? (
              <FieldError id="password-error" errors={[errors.password]} />
            ) : (
              <FieldDescription id="password-hint">At least 8 characters.</FieldDescription>
            )}
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
