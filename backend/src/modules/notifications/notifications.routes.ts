import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth';
import * as notifications from './notifications.controller';

/** Mounted at /api/notifications. Always the signed-in user's own notifications. */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', notifications.list);
notificationsRouter.get('/unread-count', notifications.unreadCount);
// Before /:notificationId so "read-all" isn't taken for an id.
notificationsRouter.patch('/read-all', notifications.readAll);
notificationsRouter.patch('/:notificationId/read', notifications.read);
