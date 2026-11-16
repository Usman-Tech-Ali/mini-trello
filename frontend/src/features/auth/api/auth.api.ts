import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@mini-trello/shared';

import { ApiError } from '@/lib/api/api-error';
import { apiRequest } from '@/lib/api/client';

/** Returns the signed-in user, or null when there is no valid session. */
export async function getCurrentUser(signal?: AbortSignal): Promise<UserDto | null> {
  try {
    const { user } = await apiRequest<AuthResponse>('/api/auth/me', { signal });
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(input: LoginInput): Promise<UserDto> {
  const { user } = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
  });
  return user;
}

export async function register(input: RegisterInput): Promise<UserDto> {
  const { user } = await apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: input,
  });
  return user;
}

export function logout(): Promise<void> {
  return apiRequest<void>('/api/auth/logout', { method: 'POST' });
}
