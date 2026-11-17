/**
 * Who is online on which board. Tracks individual sockets, so a user with several tabs open
 * stays online until their last tab leaves. In-memory: valid for a single API instance
 * (horizontal scaling would need a shared store such as Redis).
 */
export class PresenceTracker {
  private readonly boards = new Map<string, Map<string, Set<string>>>();

  /** Returns true if the user just came online on this board. */
  join(boardId: string, userId: string, socketId: string): boolean {
    let users = this.boards.get(boardId);
    if (!users) {
      users = new Map();
      this.boards.set(boardId, users);
    }
    let sockets = users.get(userId);
    const cameOnline = !sockets;
    if (!sockets) {
      sockets = new Set();
      users.set(userId, sockets);
    }
    sockets.add(socketId);
    return cameOnline;
  }

  /** Returns true if the user just went offline on this board (their last socket left). */
  leave(boardId: string, userId: string, socketId: string): boolean {
    const users = this.boards.get(boardId);
    const sockets = users?.get(userId);
    if (!users || !sockets?.delete(socketId)) return false;
    if (sockets.size > 0) return false;
    users.delete(userId);
    if (users.size === 0) this.boards.delete(boardId);
    return true;
  }

  usersOn(boardId: string): string[] {
    return [...(this.boards.get(boardId)?.keys() ?? [])];
  }

  clearBoard(boardId: string): void {
    this.boards.delete(boardId);
  }
}
