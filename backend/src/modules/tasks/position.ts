export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

/**
 * Returns a sort key that places an item at `index` among `positions` (sorted ascending,
 * excluding the moved item), or null when neighbours are too close and the column needs
 * renumbering first.
 */
export function positionForIndex(positions: readonly number[], index: number): number | null {
  const clamped = Math.min(Math.max(index, 0), positions.length);
  const before = positions[clamped - 1];
  const after = positions[clamped];

  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return (after ?? 0) - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  if (after - before < MIN_GAP) return null;
  return (before + after) / 2;
}

/** Evenly spaced positions for `count` items: 1024, 2048, … */
export function evenlySpacedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
