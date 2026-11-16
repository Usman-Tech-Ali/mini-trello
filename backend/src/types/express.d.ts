import type { MembershipContext } from '../modules/workspaces/workspace-access';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. */
    auth?: { userId: string };
    /** Set by `requireWorkspaceMember`. */
    membership?: MembershipContext;
  }
}
