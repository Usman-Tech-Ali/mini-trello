export type DependencyStatus = 'up' | 'down';

export interface DatabaseHealth {
  status: DependencyStatus;
  latencyMs: number | null;
  /** True when MongoDB runs as a replica set (or sharded cluster), which multi-document transactions require. */
  transactionsSupported: boolean | null;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  database: DatabaseHealth;
}
