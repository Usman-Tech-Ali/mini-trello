/** Stable decorative colour for an entity (workspace/board), derived from its id. */
const GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-indigo-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
  'from-cyan-500 to-blue-500',
  'from-lime-500 to-emerald-500',
] as const;

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function gradientFor(id: string): string {
  return GRADIENTS[hash(id) % GRADIENTS.length] ?? GRADIENTS[0];
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
