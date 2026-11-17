import type { TaskDto, TypingTarget } from '@mini-trello/shared';

/**
 * Applies a task received over the socket. Events can arrive late or out of order (e.g. after a
 * reconnect), so an incoming copy only wins if it is newer than what we already have.
 */
export function upsertRemoteTask(tasks: readonly TaskDto[], incoming: TaskDto): TaskDto[] {
  const current = tasks.find((task) => task.id === incoming.id);
  if (!current) return [...tasks, incoming];
  if (current.version >= incoming.version) return [...tasks];
  return tasks.map((task) => (task.id === incoming.id ? incoming : task));
}

export function removeRemoteTask(tasks: readonly TaskDto[], taskId: string): TaskDto[] {
  return tasks.filter((task) => task.id !== taskId);
}

/** Typing indicators expire on their own, so a lost "stopped typing" event can't leave one stuck. */
export const TYPING_TTL_MS = 5_000;

/** `taskId|target` → userId → expiry timestamp (ms). */
export type TypingState = ReadonlyMap<string, ReadonlyMap<string, number>>;

const stateKey = (taskId: string, target: TypingTarget) => `${taskId}|${target}`;

export function applyTyping(
  state: TypingState,
  update: { taskId: string; target: TypingTarget; userId: string; isTyping: boolean },
  now: number,
): TypingState {
  const key = stateKey(update.taskId, update.target);
  const next = new Map(state);
  const users = new Map(next.get(key));
  if (update.isTyping) users.set(update.userId, now + TYPING_TTL_MS);
  else users.delete(update.userId);
  if (users.size > 0) next.set(key, users);
  else next.delete(key);
  return next;
}

/** Drops expired indicators; returns the same object when nothing changed (avoids re-renders). */
export function pruneTyping(state: TypingState, now: number): TypingState {
  let changed = false;
  const next = new Map<string, ReadonlyMap<string, number>>();
  for (const [taskId, users] of state) {
    const alive = new Map([...users].filter(([, expiresAt]) => expiresAt > now));
    if (alive.size !== users.size) changed = true;
    if (alive.size > 0) next.set(taskId, alive);
  }
  return changed ? next : state;
}

/** Who is typing in `target` (task fields or a comment) of a task. */
export function typingUsers(
  state: TypingState,
  taskId: string,
  target: TypingTarget = 'task',
): string[] {
  return [...(state.get(stateKey(taskId, target))?.keys() ?? [])];
}

/** Tasks that currently have someone typing in `target`. */
export function typingTaskIds(state: TypingState, target: TypingTarget): string[] {
  return [...state.keys()].flatMap((key) => {
    const [taskId, keyTarget] = key.split('|');
    return taskId && keyTarget === target ? [taskId] : [];
  });
}

/** "Sara is writing a comment", "Sara and Ali are writing comments", … */
export function describeCommenters(names: readonly string[]): string {
  const [first, second] = names;
  if (!first) return '';
  if (names.length === 1) return `${first} is writing a comment`;
  if (names.length === 2) return `${first} and ${second ?? ''} are writing comments`;
  return `${first} and ${names.length - 1} others are writing comments`;
}

/** "Sara is editing", "Sara and Ali are editing", "Sara and 2 others are editing". */
export function describeEditors(names: readonly string[]): string {
  const [first, second] = names;
  if (!first) return '';
  if (names.length === 1) return `${first} is editing`;
  if (names.length === 2) return `${first} and ${second ?? ''} are editing`;
  return `${first} and ${names.length - 1} others are editing`;
}
