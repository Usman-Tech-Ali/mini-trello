import { describe, expect, it } from 'vitest';

import { getSafeRedirect } from './safe-redirect';

describe('getSafeRedirect', () => {
  it.each(['/workspaces', '/workspaces/abc?tab=members'])('allows same-site path %s', (path) => {
    expect(getSafeRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '',
    null,
    undefined,
  ])('falls back for unsafe or missing target %s', (target) => {
    expect(getSafeRedirect(target)).toBe('/workspaces');
  });
});
