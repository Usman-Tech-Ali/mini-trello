import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { renderWithQueryClient } from '@/test/render';

import { login, register } from '../api/auth.api';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => searchParams,
}));
vi.mock('../api/auth.api', () => ({ login: vi.fn(), register: vi.fn() }));

const loginMock = vi.mocked(login);
const registerMock = vi.mocked(register);
const user = { id: '507f1f77bcf86cd799439011', name: 'Ada', email: 'ada@example.com' };

function fill(label: RegExp | string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
});

describe('LoginForm', () => {
  it('validates fields before calling the API', async () => {
    renderWithQueryClient(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('shows the server message when credentials are wrong', async () => {
    loginMock.mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    renderWithQueryClient(<LoginForm />);

    fill(/email/i, 'ada@example.com');
    fill('Password', 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('signs in with normalized input and returns to the requested page', async () => {
    searchParams = new URLSearchParams({ next: '/workspaces/abc' });
    loginMock.mockResolvedValue(user);
    renderWithQueryClient(<LoginForm />);

    fill(/email/i, '  ADA@Example.com ');
    fill('Password', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/workspaces/abc');
    });
    expect(loginMock.mock.calls[0]?.[0]).toEqual({
      email: 'ada@example.com',
      password: 'correct-horse',
    });
  });
});

describe('RegisterForm', () => {
  it('shows a taken email under the email field', async () => {
    registerMock.mockRejectedValue(
      new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
        email: ['An account with this email already exists.'],
      }),
    );
    renderWithQueryClient(<RegisterForm />);

    fill(/name/i, 'Ada');
    fill(/email/i, 'ada@example.com');
    fill('Password', 'long-enough-password');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const message = await screen.findByText('An account with this email already exists.');
    // Shown once, under the field (FieldError has id="email-error"), not as a form-level banner.
    expect(message.closest('#email-error')).not.toBeNull();
    expect(screen.getAllByText('An account with this email already exists.')).toHaveLength(1);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('enforces the shared password rule', async () => {
    renderWithQueryClient(<RegisterForm />);

    fill(/name/i, 'Ada');
    fill(/email/i, 'ada@example.com');
    fill('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });
});

describe('PasswordInput toggle', () => {
  it('reveals and hides the password', () => {
    renderWithQueryClient(<LoginForm />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});
