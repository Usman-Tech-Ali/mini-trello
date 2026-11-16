import type { Request } from 'express';

// Only fails if a route is missing its middleware — a programming error, hence a plain Error (500).
export function getAuthUserId(req: Request): string {
  if (!req.auth) throw new Error('requireAuth middleware is missing on this route');
  return req.auth.userId;
}
