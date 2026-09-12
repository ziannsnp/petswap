/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { signIn } from '../lib/authApi';
import { authKeys } from './useAuth';
import { useSignIn } from './useSignIn';

jest.mock('../lib/authApi', () => ({ signIn: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockedSignIn = jest.mocked(signIn);

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the sign-in adapter and stores the returned session in the auth cache', async () => {
    const session = { access_token: 'access-token' };
    const input = { identifier: 'pat_sitter', password: 'Password1!' };
    mockedSignIn.mockResolvedValue({ user: { id: 'user-1' } as never, session: session as never });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSignIn(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockedSignIn).toHaveBeenCalledWith(input, expect.any(Object));
    await waitFor(() => {
      expect(queryClient.getQueryData(authKeys.session())).toBe(session);
    });
  });

  // A rejected attempt must not disturb whatever session the cache already holds:
  // a failed re-authentication should never sign the current user out.
  it('leaves the auth cache unchanged when sign-in fails', async () => {
    mockedSignIn.mockRejectedValue(new Error('Network error'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSignIn(), { wrapper: createWrapper(queryClient) });

    await expect(
      result.current.mutateAsync({ identifier: 'pat_sitter', password: 'Password1!' }),
    ).rejects.toThrow('Network error');

    expect(queryClient.getQueryData(authKeys.session())).toBeUndefined();
  });
});
