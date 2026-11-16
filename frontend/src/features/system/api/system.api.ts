import type { HealthResponse } from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health', { signal });
}
