'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@mini-trello/shared';
import { ArrowRightIcon, CircleCheckIcon, CircleIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { FormError } from '@/components/feedback/form-error';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/forms/apply-server-errors';
import { cn } from '@/lib/utils';

import { useRegister } from '../hooks/use-auth-mutations';
import { AuthHeader } from './auth-layout';

type RegisterFormValues = z.input<typeof registerSchema>;

const MIN_PASSWORD_LENGTH = 8;

export function RegisterForm() {
  const router = useRouter();
  const registerUser = useRegister();
  const form = useForm<RegisterFormValues, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: 'password' });
  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

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
    <>
      <AuthHeader
        title="Create your account"
        description="Set up a workspace and start planning with your team."
      />
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          <FormError message={errors.root?.server?.message} />
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              className="h-10"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              {...form.register('name')}
            />
            <FieldError id="name-error" errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
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
              autoComplete="new-password"
              placeholder="Create a password"
              className="h-10"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : 'password-rule'}
              {...form.register('password')}
            />
            {errors.password ? (
              <FieldError id="password-error" errors={[errors.password]} />
            ) : (
              <p
                id="password-rule"
                className={cn(
                  'flex items-center gap-1.5 text-sm transition-colors',
                  passwordLongEnough ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {passwordLongEnough ? (
                  <CircleCheckIcon className="size-4" aria-hidden="true" />
                ) : (
                  <CircleIcon className="size-4" aria-hidden="true" />
                )}
                At least {MIN_PASSWORD_LENGTH} characters
              </p>
            )}
          </Field>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRightIcon aria-hidden="true" />
              </>
            )}
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
