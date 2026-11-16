import type { HealthResponse } from '@mini-trello/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import { getHealth } from '../api/system.api';
import { SystemStatus } from './system-status';

vi.mock('../api/system.api', () => ({ getHealth: vi.fn() }));

const getHealthMock = vi.mocked(getHealth);

function renderWithQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SystemStatus />
    </QueryClientProvider>,
  );
}

const healthy: HealthResponse = {
  status: 'ok',
  uptimeSeconds: 12,
  timestamp: '2026-11-16T12:00:00.000Z',
  database: { status: 'up', latencyMs: 3, transactionsSupported: false },
};

describe('SystemStatus', () => {
  it('shows a loading state, then API, database and transaction status', async () => {
    getHealthMock.mockResolvedValue(healthy);

    renderWithQueryClient();

    expect(screen.getByLabelText('Loading status')).toBeInTheDocument();
    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(screen.getByText('Up · 3 ms')).toBeInTheDocument();
    expect(screen.getByText('Not supported')).toBeInTheDocument();
  });

  it('explains when the API is unreachable and offers a retry', async () => {
    getHealthMock.mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Unable to reach the server.'),
    );

    renderWithQueryClient();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The API is unreachable. Make sure the backend is running.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('explains when the API reports the database as unavailable', async () => {
    getHealthMock.mockRejectedValue(
      new ApiError(503, 'UNEXPECTED_RESPONSE', 'The server returned an unexpected response (503).'),
    );

    renderWithQueryClient();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The API is running but reports the database as unavailable.',
    );
  });
});
