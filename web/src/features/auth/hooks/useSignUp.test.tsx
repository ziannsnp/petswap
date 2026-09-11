/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { signUp } from '../lib/authApi';
import { authKeys } from './useAuth';
import { useSignUp } from './useSignUp';

jest.mock('../lib/authApi', () => ({ signUp: jest.fn() }));
jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const mockedSignUp = jest.mocked(signUp);

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSignUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the signup adapter and stores the returned session in the auth cache', async () => {
    const session = { access_token: 'access-token' };
    const input = {
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'Password1!',
      displayName: 'Pat',
    };
    mockedSignUp.mockResolvedValue({ user: { id: 'user-1' } as never, session: session as never });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSignUp(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mockedSignUp).toHaveBeenCalledWith(input, expect.any(Object));
    await waitFor(() => {
      expect(queryClient.getQueryData(authKeys.session())).toBe(session);
    });
  });

  it('leaves the auth cache unchanged when signup fails', async () => {
    mockedSignUp.mockRejectedValue(new Error('Network error'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useSignUp(), { wrapper: createWrapper(queryClient) });

    await expect(
      result.current.mutateAsync({
        email: 'pet@example.com',
        username: 'pat_sitter',
        password: 'Password1!',
        displayName: 'Pat',
      }),
    ).rejects.toThrow('Network error');

    expect(queryClient.getQueryData(authKeys.session())).toBeUndefined();
  });
});
