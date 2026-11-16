import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
