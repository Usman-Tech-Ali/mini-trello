import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { apiRequest } from './client';

function mockFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockFetchRejection(reason: unknown) {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(reason));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiRequest', () => {
  it('sends credentials and JSON bodies, and returns the parsed response', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { id: 'abc' }));

    const result = await apiRequest<{ id: string }>('/api/things', {
      method: 'POST',
      body: { name: 'Task' },
    });

    expect(result).toEqual({ id: 'abc' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/api/things');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ name: 'Task' }),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('omits the JSON content type when there is no body', async () => {
    const fetchMock = mockFetch(jsonResponse(200, {}));

    await apiRequest('/api/things');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ Accept: 'application/json' });
    expect(init?.body).toBeUndefined();
  });

  it('turns the standard API error shape into an ApiError with code and field details', async () => {
    mockFetch(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { title: ['Title is required'] },
        },
      }),
    );

    const error = await apiRequest('/api/things', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { title: ['Title is required'] },
    });
  });

  it('reports non-contract error bodies as UNEXPECTED_RESPONSE', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(apiRequest('/api/things')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE',
    });
  });

  it('reports connection failures as NETWORK_ERROR', async () => {
    mockFetchRejection(new TypeError('Failed to fetch'));

    const error = await apiRequest('/api/things').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR', isNetworkError: true });
  });

  it('rethrows aborts unchanged so TanStack Query can treat them as cancellations', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    mockFetchRejection(abortError);

    await expect(apiRequest('/api/things', { signal: controller.signal })).rejects.toBe(abortError);
  });
});
