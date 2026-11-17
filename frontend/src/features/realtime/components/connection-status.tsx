'use client';

import { cn } from '@/lib/utils';

import { useConnectionStatus, type ConnectionStatus } from '../realtime-provider';

const STATUS: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connected: { label: 'Live', dot: 'bg-success', text: 'text-success' },
  connecting: { label: 'Connecting…', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-warning', text: 'text-warning-foreground' },
  offline: {
    label: 'Offline — refresh to reconnect',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
};

/** Shows whether live updates are flowing. Changes made while reconnecting resync automatically. */
export function ConnectionStatusBadge() {
  const status = useConnectionStatus();
  const { label, dot, text } = STATUS[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium',
        text,
      )}
    >
      <span
        className={cn('size-1.5 rounded-full', dot, status === 'reconnecting' && 'animate-pulse')}
      />
      {label}
    </span>
  );
}
