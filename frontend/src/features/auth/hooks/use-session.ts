import type { UserDto } from '@mini-trello/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';

import { getCurrentUser } from '../api/auth.api';
import { authKeys } from '../api/auth.keys';

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: ({ signal }) => getCurrentUser(signal),
    staleTime: 5 * 60_000,
  });
}

/** For components rendered inside the authenticated area, where a user is guaranteed. */
export function useCurrentUser(): UserDto {
  const { data } = useSession();
  if (!data) throw new Error('useCurrentUser must be used inside the authenticated app area');
  return data;
}

/** Marks the session as signed in or out and drops every other cached query. */
export function setSession(queryClient: QueryClient, user: UserDto | null): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
  queryClient.setQueryData(authKeys.session(), user);
}
