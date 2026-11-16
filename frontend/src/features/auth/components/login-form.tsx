'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@mini-trello/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FormError } from '@/components/feedback/form-error';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { getSafeRedirect } from '@/lib/safe-redirect';

import { useLogin } from '../hooks/use-auth-mutations';
import { AuthCard } from './auth-card';

type LoginFormValues = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const form = useForm<LoginFormValues, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(getSafeRedirect(searchParams.get('next')));
    } catch (error) {
      if (error instanceof Error) applyServerErrors(error, form.setError, ['email', 'password']);
    }
  });

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to see your boards."
      footer={
        <>
          No account yet?{' '}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          <FormError message={errors.root?.server?.message} />
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
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...form.register('password')}
            />
            <FieldError id="password-error" errors={[errors.password]} />
          </Field>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
