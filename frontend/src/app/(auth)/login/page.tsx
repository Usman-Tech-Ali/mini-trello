import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  // LoginForm reads ?next= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
