import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn('size-8', className)}>
      <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
