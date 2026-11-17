/**
 * Stable identity colour for a workspace or board, derived from its id. Muted, ink-like tones
 * that sit with the pine-and-graphite palette (no gradients). All keep white initials readable
 * at the sizes used (≥ 4.5:1).
 */
const SWATCHES = [
  'bg-[#1f5a45]', // pine
  'bg-[#3f6f8f]', // steel
  'bg-[#8a6a1f]', // ochre
  'bg-[#9c3b2f]', // brick
  'bg-[#5b4f8a]', // slate violet
  'bg-[#2f6b6b]', // teal
  'bg-[#6b5a48]', // walnut
  'bg-[#2c3330]', // graphite
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
