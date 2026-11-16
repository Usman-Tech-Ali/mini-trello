import { useQuery } from '@tanstack/react-query';

import { getHealth } from '../api/system.api';
import { systemKeys } from '../api/system.keys';

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health(),
    queryFn: ({ signal }) => getHealth(signal),
    // A status check should report the current state immediately rather than retry it away.
    retry: false,
    staleTime: 0,
  });
}
