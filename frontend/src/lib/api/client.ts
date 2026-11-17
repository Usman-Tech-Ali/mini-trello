import { apiErrorResponseSchema, SOCKET_ID_HEADER } from '@mini-trello/shared';

import { env } from '@/config/env';
import { getSocketId } from '@/lib/realtime/socket';

import { ApiError } from './api-error';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const parsed = apiErrorResponseSchema.safeParse(payload);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(status, code, message, details);
  }
  return new ApiError(
    status,
    'UNEXPECTED_RESPONSE',
    `The server returned an unexpected response (${status}).`,
  );
}

/**
 * Single entry point for calling the API. Sends the auth cookie (`credentials: 'include'`),
 * serializes JSON bodies, and turns every failure into an `ApiError`.
 *
 * The response type is the caller's contract with the API (types come from `@mini-trello/shared`);
 * responses are not re-validated at runtime.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const headers: HeadersInit = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const socketId = getSocketId();
  if (socketId) headers[SOCKET_ID_HEADER] = socketId;

  let response: Response;
  try {
    response = await fetch(`${env.restBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (error) {
    // Let cancellations propagate untouched so TanStack Query can recognise them.
    if (signal?.aborted) throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection and try again.',
    );
  }

  const payload = await readJson(response);
  if (!response.ok) throw toApiError(response.status, payload);
  return payload as T;
}
