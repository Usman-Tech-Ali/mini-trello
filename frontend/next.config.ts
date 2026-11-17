import type { NextConfig } from 'next';

// The API sends its own security headers (helmet); these cover the pages themselves.
const securityHeaders = [
  // The app must never be framed by another site (clickjacking, e.g. tricking a "Delete" click).
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The shared API contract package ships TypeScript source.
  transpilePackages: ['@mini-trello/shared'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // With NEXT_PUBLIC_API_PROXY=true the browser calls this site's /api/* and /health, and Next.js
  // forwards them to the API, so the session cookie belongs to this site (works where browsers
  // block third-party cookies: Safari, Chrome Incognito). Socket.IO still connects directly.
  rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
    if (process.env.NEXT_PUBLIC_API_PROXY !== 'true' || !api) return Promise.resolve([]);
    return Promise.resolve([
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/health', destination: `${api}/health` },
    ]);
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
