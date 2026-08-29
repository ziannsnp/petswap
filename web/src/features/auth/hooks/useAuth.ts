import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase';
import { getCurrentSession, signOut } from '../lib/authApi';

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useQuery({
    queryKey: authKeys.session(),
    queryFn: getCurrentSession,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, newSession) => {
      queryClient.setQueryData(authKeys.session(), newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    session: session ?? null,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    isLoading,
    error,
    signOut,
  };
}
