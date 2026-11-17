import { Router } from 'express';

import { config } from '../../config/env';
import { createAuthRateLimiter } from '../../lib/rate-limit';
import { requireAuth } from '../../middleware/require-auth';
import { login, logout, me, register, socketTicket } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', createAuthRateLimiter({ limit: config.authRateLimitMax }), register);
authRouter.post(
  '/login',
  createAuthRateLimiter({ limit: config.authRateLimitMax, failedOnly: true }),
  login,
);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
// POST, so the Origin allowlist check applies.
authRouter.post('/socket-ticket', requireAuth, socketTicket);
