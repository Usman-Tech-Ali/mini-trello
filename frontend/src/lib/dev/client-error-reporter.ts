import type { ClientLogInput } from '@mini-trello/shared';

import { env } from '@/config/env';

/**
 * Development only: forwards browser errors to the API's test-session log (logs/dev.log), so a
 * manual test run can be reviewed afterwards in one timeline with the API requests.
 */

const DEDUPE_WINDOW_MS = 5_000;
const recent = new Map<string, number>();

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: value.message, stack: value.stack };
  if (typeof value === 'string') return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

export function reportClientError(source: ClientLogInput['source'], value: unknown): void {
  if (process.env.NODE_ENV !== 'development') return;
  const { message, stack } = describe(value);
  const key = `${source}:${message}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - DEDUPE_WINDOW_MS) return;
  recent.set(key, now);

  const entry: ClientLogInput = {
    level: 'error',
    source,
    message: message.slice(0, 2000) || '(empty error)',
    stack: stack?.slice(0, 8000),
    url: window.location.pathname + window.location.search,
  };
  // Fire and forget; a failing reporter must never cause more errors.
  fetch(`${env.restBaseUrl}/api/dev/client-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    credentials: 'include',
    keepalive: true,
  }).catch(() => undefined);
}

/** Installs global listeners; returns a cleanup function. */
export function installClientErrorReporter(): () => void {
  if (process.env.NODE_ENV !== 'development') return () => undefined;

  const onError = (event: ErrorEvent) => {
    reportClientError('window.onerror', event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError('unhandledrejection', event.reason);
  };
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    reportClientError('console.error', args.map((arg) => describe(arg).message).join(' '));
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    console.error = originalConsoleError;
  };
}
