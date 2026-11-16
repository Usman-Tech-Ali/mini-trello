'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@mini-trello/shared';
import { ArrowRightIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { FormError } from '@/components/feedback/form-error';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { getSafeRedirect } from '@/lib/safe-redirect';

import { useLogin } from '../hooks/use-auth-mutations';
import { AuthHeader } from './auth-layout';

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
    <>
      <AuthHeader title="Welcome back" description="Sign in to pick up where your team left off." />
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          <FormError message={errors.root?.server?.message} />
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="h-10"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...form.register('email')}
            />
            <FieldError id="email-error" errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Your password"
              className="h-10"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...form.register('password')}
            />
            <FieldError id="password-error" errors={[errors.password]} />
          </Field>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRightIcon aria-hidden="true" />
              </>
            )}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Mini Trello?{' '}
        <Link
          href="/register"
          className="font-medium text-brand-text underline underline-offset-4 hover:no-underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
