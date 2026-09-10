import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient, isSupabaseConfigured } from '@/shared/lib/supabase';
import { getCurrentSession, signOut as apiSignOut } from '../lib/authApi';
import { AuthContext, authKeys, type AuthContextValue } from '../context/authContext';

export interface AuthProviderProps {
  children?: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: authKeys.session(),
    queryFn: configured ? getCurrentSession : async () => null,
    staleTime: 5 * 60 * 1000,
    enabled: configured,
  });

  useEffect(() => {
    if (!configured) {
      return;
    }

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, newSession) => {
      queryClient.setQueryData(authKeys.session(), newSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured, queryClient]);

  const handleSignOut = useCallback(async () => {
    try {
      if (configured) {
        await apiSignOut();
      }
    } finally {
      queryClient.setQueryData(authKeys.session(), null);
    }
  }, [configured, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: session ?? null,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      isLoading: configured ? isLoading : false,
      error: configured ? ((error as Error | null) ?? null) : null,
      signOut: handleSignOut,
    }),
    [configured, session, isLoading, error, handleSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
