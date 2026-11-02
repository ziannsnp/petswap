/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CheckEmailScreen, RESEND_COOLDOWN_SECONDS } from './CheckEmailScreen';
import { useResendConfirmation } from '../hooks/useResendConfirmation';
import { ResendConfirmationError } from '../lib/authApi';

jest.mock('../hooks/useResendConfirmation', () => ({
  useResendConfirmation: jest.fn(),
}));

jest.mock('../lib/authApi', () => ({
  ResendConfirmationError: class ResendConfirmationError extends Error {
    constructor(public readonly code: string) {
      super(
        code === 'RATE_LIMITED'
          ? 'Too many attempts. Please try again later.'
          : 'We could not resend the confirmation email. Please try again.',
      );
      this.name = 'ResendConfirmationError';
    }
  },
}));

const mockedUseResendConfirmation = jest.mocked(useResendConfirmation);

function mutationResult(overrides: Partial<ReturnType<typeof useResendConfirmation>> = {}) {
  return {
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useResendConfirmation>;
}

function renderScreen(initialEntry = '/check-email', state?: { email?: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialEntry, state }]}>
      <Routes>
        <Route path="/check-email" element={<CheckEmailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CheckEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders with email from route state and has Resend button enabled', () => {
    mockedUseResendConfirmation.mockReturnValue(mutationResult());
    renderScreen('/check-email', { email: 'pet@example.com' });

    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText('pet@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /resend confirmation email/i }),
    ).toBeEnabled();
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('renders email input when no email is provided in route state', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockedUseResendConfirmation.mockReturnValue(mutationResult());
    renderScreen('/check-email');

    const input = screen.getByLabelText(/email address/i);
    const button = screen.getByRole('button', { name: /resend confirmation email/i });

    expect(input).toHaveValue('');
    expect(button).toBeDisabled();

    await user.type(input, 'invalid-email');
    expect(button).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'valid@example.com');
    expect(button).toBeEnabled();
  });

  it('calls resend mutation and starts cooldown timer upon clicking Resend', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    mockedUseResendConfirmation.mockReturnValue(mutationResult({ mutateAsync }));
    renderScreen('/check-email', { email: 'pet@example.com' });

    const button = screen.getByRole('button', { name: /resend confirmation email/i });
    await user.click(button);

    expect(mutateAsync).toHaveBeenCalledWith('pet@example.com');

    // Shows success message
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Confirmation email resent! Please check your inbox or spam folder.',
    );

    // Button is disabled with cooldown
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(`Resend email in ${RESEND_COOLDOWN_SECONDS}s`);

    // Advance 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(button).toHaveTextContent(`Resend email in ${RESEND_COOLDOWN_SECONDS - 1}s`);

    // Advance remaining cooldown
    act(() => {
      jest.advanceTimersByTime((RESEND_COOLDOWN_SECONDS - 1) * 1000);
    });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Resend confirmation email');
  });

  it('renders an error alert when resend fails', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const mutateAsync = jest
      .fn()
      .mockRejectedValue(new ResendConfirmationError('RATE_LIMITED'));
    mockedUseResendConfirmation.mockReturnValue(
      mutationResult({
        mutateAsync,
        isError: true,
        error: new ResendConfirmationError('RATE_LIMITED'),
      }),
    );
    renderScreen('/check-email', { email: 'pet@example.com' });

    const button = screen.getByRole('button', { name: /resend confirmation email/i });
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Please try again later.',
    );
  });

  it('allows switching to edit email mode when "Wrong email address?" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockedUseResendConfirmation.mockReturnValue(mutationResult());
    renderScreen('/check-email', { email: 'initial@example.com' });

    await user.click(screen.getByRole('button', { name: /wrong email address\?/i }));

    const input = screen.getByLabelText(/email address/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('initial@example.com');

    await user.clear(input);
    await user.type(input, 'updated@example.com');

    const button = screen.getByRole('button', { name: /resend confirmation email/i });
    expect(button).toBeEnabled();
  });

  it('disables the button while resend request is pending', () => {
    mockedUseResendConfirmation.mockReturnValue(mutationResult({ isPending: true }));
    renderScreen('/check-email', { email: 'pet@example.com' });

    const button = screen.getByRole('button', { name: /sending\.\.\./i });
    expect(button).toBeDisabled();
  });
});

