import type { ColumnDto, TaskDto } from '@mini-trello/shared';
import { POSITION_STEP, positionForIndex } from '@mini-trello/shared';

/** Tasks grouped by column id, each group sorted by position (unknown columns are dropped). */
export function groupTasksByColumn(
  columns: readonly ColumnDto[],
  tasks: readonly TaskDto[],
): Map<string, TaskDto[]> {
  const groups = new Map<string, TaskDto[]>(columns.map((column) => [column.id, []]));
  for (const task of tasks) groups.get(task.columnId)?.push(task);
  for (const group of groups.values()) group.sort((a, b) => a.position - b.position);
  return groups;
}

/**
 * Returns the task list with one task moved to `index` within `columnId`, using the same ordering
 * rule as the API, so an optimistic move lands exactly where the server will put it.
 */
export function applyMove(
  tasks: readonly TaskDto[],
  taskId: string,
  columnId: string,
  index: number,
): TaskDto[] {
  const siblings = tasks
    .filter((task) => task.columnId === columnId && task.id !== taskId)
    .sort((a, b) => a.position - b.position);
  const position =
    positionForIndex(
      siblings.map((task) => task.position),
      index,
    ) ?? (siblings[index - 1]?.position ?? 0) + POSITION_STEP / 2;
  return tasks.map((task) => (task.id === taskId ? { ...task, columnId, position } : task));
}

/**
 * Converts a drop index in a filtered column (only matching tasks shown) into the index among
 * all of the column's tasks, which is what the API expects. The task lands just before the
 * visible task it was dropped above, or just after the last visible one.
 */
export function toColumnIndex(
  columnTasks: readonly TaskDto[],
  visibleTasks: readonly TaskDto[],
  taskId: string,
  visibleIndex: number,
): number {
  const all = columnTasks.filter((task) => task.id !== taskId);
  const visible = visibleTasks.filter((task) => task.id !== taskId);
  const before = visible[visibleIndex];
  if (before) return all.findIndex((task) => task.id === before.id);
  const last = visible.at(-1);
  return last ? all.findIndex((task) => task.id === last.id) + 1 : all.length;
}
