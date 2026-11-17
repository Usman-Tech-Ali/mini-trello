import type { BoardAccess, TaskAccess } from '../modules/boards/board-access';
import type { MembershipContext } from '../modules/workspaces/workspace-access';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. */
    auth?: { userId: string; /** Unix seconds. */ sessionExpiresAt: number };
    /** Set by `requireWorkspaceMember`. */
    membership?: MembershipContext;
    /** Set by `requireBoardAccess`. */
    boardAccess?: BoardAccess;
    /** Set by `requireTaskAccess`. */
    taskAccess?: TaskAccess;
  }

  interface Locals {
    /** Set by the error handler so request logs include the API error code. */
    errorCode?: string;
  }
}
