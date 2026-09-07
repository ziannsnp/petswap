import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase';
import { getCurrentSession, signOut } from '../lib/authApi';

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

const DEV_MOCK_USER = {
  id: 'dev-demo-user-1234',
  app_metadata: {},
  user_metadata: { display_name: 'Demo Tester' },
  aud: 'authenticated',
  created_at: '2026-09-01T00:00:00.000Z',
  email: 'demo@petswap.local',
};

const DEV_MOCK_SESSION = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: DEV_MOCK_USER,
};

function isDevMockSession(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage?.getItem('petswap_dev_mock_session') === 'true'
    );
  } catch {
    return false;
  }
}

export function useAuth() {
  const isDevMock = isDevMockSession();

  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useQuery({
    queryKey: authKeys.session(),
    queryFn: getCurrentSession,
    staleTime: 5 * 60 * 1000,
    enabled: !isDevMock,
  });

  useEffect(() => {
    if (isDevMock) return;

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, newSession) => {
      queryClient.setQueryData(authKeys.session(), newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, isDevMock]);

  if (isDevMock) {
    return {
      session: DEV_MOCK_SESSION as never,
      user: DEV_MOCK_USER as never,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      signOut: async () => {
        localStorage.removeItem('petswap_dev_mock_session');
        queryClient.setQueryData(authKeys.session(), null);
        window.location.reload();
      },
    };
  }

  return {
    session: session ?? null,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    isLoading,
    error,
    signOut,
  };
}
