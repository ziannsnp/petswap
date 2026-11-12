/** @jest-environment jsdom */
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConfirmationLanding } from './useConfirmationLanding';
import { discardConfirmationSession } from '../lib/authApi';

// Factory form avoids loading the real adapter, which transitively hits import.meta.env.
jest.mock('../lib/authApi', () => ({ discardConfirmationSession: jest.fn() }));

const mockedDiscard = jest.mocked(discardConfirmationSession);

function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => useConfirmationLanding(), { wrapper });
}

describe('useConfirmationLanding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDiscard.mockResolvedValue(undefined);
  });

  it('reports nothing and keeps the session on a plain visit to the login page', () => {
    const { result } = renderAt('/login');

    expect(result.current).toBeNull();
    expect(mockedDiscard).not.toHaveBeenCalled();
  });

  it('reports a confirmation and drops the session the link signed in', async () => {
    const { result } = renderAt('/login?confirmed=1#access_token=a&type=signup');

    expect(result.current).toBe('confirmed');
    await waitFor(() => expect(mockedDiscard).toHaveBeenCalledTimes(1));
  });

  it('still reports the confirmation when dropping the session fails', async () => {
    mockedDiscard.mockRejectedValue(new Error('offline'));
    const { result } = renderAt('/login?confirmed=1');

    await waitFor(() => expect(mockedDiscard).toHaveBeenCalled());
    expect(result.current).toBe('confirmed');
  });

  it('reports a failed link without touching the session', () => {
    const { result } = renderAt('/login?confirmed=1#error=access_denied&error_code=otp_expired');

    expect(result.current).toBe('failed');
    expect(mockedDiscard).not.toHaveBeenCalled();
  });
});
