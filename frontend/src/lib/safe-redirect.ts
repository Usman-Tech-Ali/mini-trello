/**
 * Returns `target` only if it is a same-site path ("/workspaces/1"), never an absolute or
 * protocol-relative URL ("https://evil.example", "//evil.example") — prevents open redirects.
 */
export function getSafeRedirect(
  target: string | null | undefined,
  fallback = '/workspaces',
): string {
  if (!target?.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback;
  }
  return target;
}
