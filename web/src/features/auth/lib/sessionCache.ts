import type { Session } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';
import { authKeys } from '../context/authContext';

/**
 * Stores the current session in the query cache. When the signed-in user
 * changes (sign-out, or a different account signing in), every other cached
 * query is removed first: bookings and the current profile are cached under
 * keys that do not include the user id, so without this the next user in the
 * same tab is shown the previous user's data until the cache goes stale.
 */
export function setSessionCache(queryClient: QueryClient, session: Session | null): void {
  const previous = queryClient.getQueryData<Session | null>(authKeys.session());
  const previousUserId = previous?.user?.id ?? null;
  const nextUserId = session?.user?.id ?? null;

  if (previousUserId !== null && previousUserId !== nextUserId) {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== authKeys.all[0],
    });
  }

  queryClient.setQueryData(authKeys.session(), session);
}
