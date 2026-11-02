/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { resendConfirmationEmail } from '../lib/authApi';
import { useResendConfirmation } from './useResendConfirmation';

jest.mock('../lib/authApi', () => ({
  resendConfirmationEmail: jest.fn(),
}));

const mockedResendConfirmationEmail = jest.mocked(resendConfirmationEmail);

function createWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useResendConfirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls resendConfirmationEmail with the given email address', async () => {
    mockedResendConfirmationEmail.mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useResendConfirmation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('pet@example.com');
    });

    expect(mockedResendConfirmationEmail).toHaveBeenCalledWith('pet@example.com');
  });

  it('surfaces error when resendConfirmationEmail fails', async () => {
    mockedResendConfirmationEmail.mockRejectedValue(new Error('Rate limited'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useResendConfirmation(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync('pet@example.com')).rejects.toThrow('Rate limited');
  });
});

