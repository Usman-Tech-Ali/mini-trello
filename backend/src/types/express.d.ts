import type { BoardAccess, TaskAccess } from '../modules/boards/board-access';
import type { MembershipContext } from '../modules/workspaces/workspace-access';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. */
    auth?: { userId: string };
    /** Set by `requireWorkspaceMember`. */
    membership?: MembershipContext;
    /** Set by `requireBoardAccess`. */
    boardAccess?: BoardAccess;
    /** Set by `requireTaskAccess`. */
    taskAccess?: TaskAccess;
  }
}
