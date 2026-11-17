import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authKeys } from '../api/auth.keys';
import { setSession, useCurrentUser } from '../hooks/use-session';
import { AuthGuard } from './auth-guard';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/workspaces',
}));

const user = { id: '507f1f77bcf86cd799439011', name: 'Ada', email: 'ada@example.com' };

function Greeting() {
  return <p>Hello {useCurrentUser().name}</p>;
}

function renderGuard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(authKeys.session(), user);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Greeting />
      </AuthGuard>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => replace.mockReset());

describe('AuthGuard', () => {
  it('gives the signed-in user to the app', () => {
    renderGuard();
    expect(screen.getByText('Hello Ada')).toBeInTheDocument();
  });

  it('sends the user to sign in, without crashing, when a request finds the session gone', async () => {
    const queryClient = renderGuard();

    // What the global 401 handler does, e.g. when the browser dropped the session cookie.
    act(() => setSession(queryClient, null));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?next=%2Fworkspaces'));
    expect(screen.queryByText(/Hello/)).not.toBeInTheDocument();
  });
});
