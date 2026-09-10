import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase';
import { getCurrentSession, signOut as apiSignOut } from '../lib/authApi';
import { AuthContext, authKeys, type AuthContextValue } from '../context/authContext';

export interface AuthProviderProps {
  children?: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: authKeys.session(),
    queryFn: getCurrentSession,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, newSession) => {
      queryClient.setQueryData(authKeys.session(), newSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const handleSignOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      queryClient.setQueryData(authKeys.session(), null);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: session ?? null,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      error: (error as Error | null) ?? null,
      signOut: handleSignOut,
    }),
    [session, isLoading, error, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
