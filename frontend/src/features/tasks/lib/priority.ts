import type { TaskPriority } from '@mini-trello/shared';
import { ChevronDownIcon, ChevronUpIcon, EqualIcon, type LucideIcon } from 'lucide-react';

export const PRIORITIES: readonly TaskPriority[] = ['high', 'medium', 'low'];

export const priorityConfig: Record<
  TaskPriority,
  { label: string; icon: LucideIcon; className: string }
> = {
  high: { label: 'High', icon: ChevronUpIcon, className: 'bg-destructive/10 text-destructive' },
  medium: { label: 'Medium', icon: EqualIcon, className: 'bg-warning/25 text-warning-foreground' },
  low: { label: 'Low', icon: ChevronDownIcon, className: 'bg-success/15 text-success' },
};
