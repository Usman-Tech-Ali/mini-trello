/**
 * Stable identity colour for a workspace or board, derived from its id. Flat, earthy tones that
 * sit with the warm-neutral palette (no gradients, no blue/purple). All keep white initials
 * readable at the sizes used (≥ 3:1).
 */
const SWATCHES = [
  'bg-[oklch(0.58_0.14_40)]', // clay
  'bg-[oklch(0.6_0.12_75)]', // ochre
  'bg-[oklch(0.55_0.1_120)]', // olive
  'bg-[oklch(0.55_0.07_155)]', // sage
  'bg-[oklch(0.45_0.08_155)]', // forest
  'bg-[oklch(0.55_0.13_15)]', // rose
  'bg-[oklch(0.48_0.06_55)]', // walnut
  'bg-[oklch(0.32_0.01_60)]', // charcoal
] as const;

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function swatchFor(id: string): string {
  return SWATCHES[hash(id) % SWATCHES.length] ?? SWATCHES[0];
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
