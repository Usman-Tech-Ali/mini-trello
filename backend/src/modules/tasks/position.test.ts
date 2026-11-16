import { describe, expect, it } from 'vitest';

import { evenlySpacedPositions, POSITION_STEP, positionForIndex } from './position';

describe('positionForIndex', () => {
  it('starts an empty column at the step', () => {
    expect(positionForIndex([], 0)).toBe(POSITION_STEP);
  });

  it('places before the first, after the last, and between neighbours', () => {
    const positions = [1024, 2048, 3072];
    expect(positionForIndex(positions, 0)).toBe(0);
    expect(positionForIndex(positions, 3)).toBe(4096);
    expect(positionForIndex(positions, 1)).toBe(1536);
  });

  it('clamps out-of-range indexes to the end', () => {
    expect(positionForIndex([1024], 99)).toBe(2048);
  });

  it('asks for renumbering when neighbours are too close', () => {
    expect(positionForIndex([1, 1 + 1e-9], 1)).toBeNull();
  });

  it('produces strictly ordered positions after many inserts at the same spot', () => {
    let positions = [1024, 2048];
    for (let i = 0; i < 40; i += 1) {
      const next = positionForIndex(positions, 1);
      if (next === null) {
        positions = evenlySpacedPositions(positions.length);
        continue;
      }
      positions = [...positions.slice(0, 1), next, ...positions.slice(1)];
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});
