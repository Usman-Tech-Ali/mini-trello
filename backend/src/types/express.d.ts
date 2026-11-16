declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. */
    auth?: { userId: string };
  }
}

export {};
