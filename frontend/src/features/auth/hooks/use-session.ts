import type { UserDto } from '@mini-trello/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import { getCurrentUser } from '../api/auth.api';
import { authKeys } from '../api/auth.keys';

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: ({ signal }) => getCurrentUser(signal),
    staleTime: 5 * 60_000,
  });
}

/**
 * The signed-in user, provided by AuthGuard from the same render that decided to show the app.
 * Reading it from context (not the query cache) means a 401 that clears the session can never
 * reach a component that is about to unmount; the guard swaps the page for a loader instead.
 */
export const CurrentUserContext = createContext<UserDto | null>(null);

/** For components rendered inside the authenticated area, where a user is guaranteed. */
export function useCurrentUser(): UserDto {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside the authenticated app area');
  return user;
}

/** Marks the session as signed in or out and drops every other cached query. */
export function setSession(queryClient: QueryClient, user: UserDto | null): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKeys.all[0] });
  queryClient.setQueryData(authKeys.session(), user);
}
