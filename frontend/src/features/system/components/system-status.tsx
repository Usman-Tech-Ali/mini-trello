'use client';

import type { HealthResponse } from '@mini-trello/shared';
import { RefreshCwIcon } from 'lucide-react';

import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/api-error';

import { useHealth } from '../hooks/use-health';

type Tone = 'success' | 'warning' | 'destructive';

const toneClasses: Record<Tone, string> = {
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-white',
};

function StatusRow({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd>
        <Badge className={toneClasses[tone]}>{value}</Badge>
      </dd>
    </div>
  );
}

function HealthDetails({ health }: { health: HealthResponse }) {
  const { database } = health;
  return (
    <dl className="divide-y">
      <StatusRow label="API" value="Reachable" tone="success" />
      <StatusRow
        label="Database"
        value={database.status === 'up' ? `Up · ${database.latencyMs ?? '?'} ms` : 'Down'}
        tone={database.status === 'up' ? 'success' : 'destructive'}
      />
      {database.transactionsSupported !== null && (
        <StatusRow
          label="Transactions (replica set)"
          value={database.transactionsSupported ? 'Supported' : 'Not supported'}
          tone={database.transactionsSupported ? 'success' : 'warning'}
        />
      )}
    </dl>
  );
}

function describeError(error: Error): string {
  if (error instanceof ApiError && error.isNetworkError) {
    return 'The API is unreachable. Make sure the backend is running.';
  }
  if (error instanceof ApiError && error.status === 503) {
    return 'The API is running but reports the database as unavailable.';
  }
  return error.message;
}

export function SystemStatus() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useHealth();

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>System status</CardTitle>
        <CardDescription>
          {dataUpdatedAt > 0
            ? `Last checked ${new Date(dataUpdatedAt).toLocaleTimeString()}`
            : 'Checking backend connectivity…'}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Check again"
          >
            <RefreshCwIcon className={isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent aria-live="polite" aria-busy={isFetching}>
        {isPending ? (
          <div className="space-y-3" aria-label="Loading status">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : error ? (
          <ErrorState
            title="Status check failed"
            message={describeError(error)}
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        ) : (
          <HealthDetails health={data} />
        )}
      </CardContent>
    </Card>
  );
}
