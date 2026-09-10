/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { getSupabaseClient } from '@/shared/lib/supabase';
import { getCurrentSession, signOut } from '../lib/authApi';
import { AuthProvider } from '../components/AuthProvider';
import { useAuth } from './useAuth';

jest.mock('../lib/authApi', () => ({
  getCurrentSession: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/shared/lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockedGetCurrentSession = jest.mocked(getCurrentSession);
const mockedSignOut = jest.mocked(signOut);
const mockedGetSupabaseClient = jest.mocked(getSupabaseClient);

function createWrapper(queryClient: QueryClient) {
  return function AuthWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('useAuth and AuthProvider', () => {
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeMock = jest.fn();
    mockedGetSupabaseClient.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: unsubscribeMock } },
        })),
      },
    } as never);
  });

  it('throws an error when used outside of an AuthProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
    consoleSpy.mockRestore();
  });

  it('loads existing persistent session from Supabase on mount', async () => {
    const mockUser = { id: 'user-123', email: 'owner@example.com' };
    const mockSession = { user: mockUser, access_token: 'token-abc' };
    mockedGetCurrentSession.mockResolvedValue(mockSession as never);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.error).toBeNull();
  });

  it('provides unauthenticated state when no persistent session exists', async () => {
    mockedGetCurrentSession.mockResolvedValue(null);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('updates auth state when onAuthStateChange emits SIGNED_IN', async () => {
    mockedGetCurrentSession.mockResolvedValue(null);
    let authCallback: ((event: string, session: unknown) => void) | undefined;
    mockedGetSupabaseClient.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn((cb) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: unsubscribeMock } } };
        }),
      },
    } as never);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);

    const newUser = { id: 'user-456', email: 'sitter@example.com' };
    const newSession = { user: newUser, access_token: 'new-token' };

    act(() => {
      authCallback?.('SIGNED_IN', newSession);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(newUser);
      expect(result.current.session).toEqual(newSession);
    });
  });

  it('clears session state when onAuthStateChange emits SIGNED_OUT', async () => {
    const mockUser = { id: 'user-123' };
    const mockSession = { user: mockUser };
    mockedGetCurrentSession.mockResolvedValue(mockSession as never);
    let authCallback: ((event: string, session: unknown) => void) | undefined;
    mockedGetSupabaseClient.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn((cb) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: unsubscribeMock } } };
        }),
      },
    } as never);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      authCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  it('updates session when onAuthStateChange emits TOKEN_REFRESHED', async () => {
    const originalSession = { user: { id: 'user-1' }, access_token: 'token-v1' };
    mockedGetCurrentSession.mockResolvedValue(originalSession as never);
    let authCallback: ((event: string, session: unknown) => void) | undefined;
    mockedGetSupabaseClient.mockReturnValue({
      auth: {
        onAuthStateChange: jest.fn((cb) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: unsubscribeMock } } };
        }),
      },
    } as never);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.session).toEqual(originalSession);
    });

    const refreshedSession = { user: { id: 'user-1' }, access_token: 'token-v2' };
    act(() => {
      authCallback?.('TOKEN_REFRESHED', refreshedSession);
    });

    await waitFor(() => {
      expect(result.current.session).toEqual(refreshedSession);
    });
  });

  it('calls signOut and clears cached session', async () => {
    const mockSession = { user: { id: 'user-1' } };
    mockedGetCurrentSession.mockResolvedValue(mockSession as never);
    mockedSignOut.mockResolvedValue(undefined);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockedSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('clears cached session even if apiSignOut throws an error', async () => {
    const mockSession = { user: { id: 'user-1' } };
    mockedGetCurrentSession.mockResolvedValue(mockSession as never);
    mockedSignOut.mockRejectedValue(new Error('Network error'));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await expect(result.current.signOut()).rejects.toThrow('Network error');

    await waitFor(() => {
      expect(result.current.session).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('unsubscribes from onAuthStateChange when AuthProvider unmounts', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
