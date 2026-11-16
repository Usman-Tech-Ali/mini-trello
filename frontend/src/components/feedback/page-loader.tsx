import { Loader2Icon } from 'lucide-react';

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-1 items-center justify-center gap-2 p-8 text-muted-foreground"
    >
      <Loader2Icon className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
