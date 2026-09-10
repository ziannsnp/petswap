/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';
import { useSignUp } from '../hooks/useSignUp';
import { SignUpError } from '../lib/authApi';
import type { SignUpErrorCode } from '../types';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Factory form avoids loading the real modules, which transitively hit import.meta.env.
jest.mock('../hooks/useSignUp', () => ({ useSignUp: jest.fn() }));
jest.mock('../lib/authApi', () => ({
  // Skips the real code->message lookup table; that translation is covered by authApi.test.ts.
  SignUpError: class SignUpError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'SignUpError';
      // The real class carries the code alongside the message; the form routes on it.
      this.code = code;
    }
  },
}));

const mockedUseSignUp = jest.mocked(useSignUp);

function renderForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  );
}

function mutationResult(overrides: Partial<ReturnType<typeof useSignUp>> = {}) {
  return {
    mutateAsync: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useSignUp>;
}

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks submission and shows a validation error when required fields are empty', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Complete all required fields.');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks submission and shows a validation error when consent is not accepted', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example.com');
    await user.type(screen.getByLabelText(/username/i), 'pat_sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You must accept the Terms of Service and Privacy Policy.',
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks submission when the username format is invalid', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example.com');
    await user.type(screen.getByLabelText(/username/i), 'pat-sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Username must be 3–30 characters and contain only letters, numbers, and underscores.',
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks submission when the email format is invalid', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example');
    await user.type(screen.getByLabelText(/username/i), 'pat_sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address, for example name@example.com.',
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('marks the offending field invalid and describes it beside the input', async () => {
    const user = userEvent.setup();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync: jest.fn() }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example');
    await user.type(screen.getByLabelText(/username/i), 'pat_sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const emailInput = await screen.findByLabelText(/email/i);
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));
    expect(emailInput).toHaveAccessibleDescription(
      'Enter a valid email address, for example name@example.com.',
    );
    expect(screen.getByLabelText(/username/i)).not.toHaveAttribute('aria-invalid');
  });

  it('retracts a field error once the user edits that field', async () => {
    const user = userEvent.setup();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync: jest.fn() }));
    renderForm();

    await user.click(screen.getByRole('button', { name: /create account/i }));
    const emailInput = await screen.findByLabelText(/email/i);
    await waitFor(() => expect(emailInput).toHaveAttribute('aria-invalid', 'true'));

    await user.type(emailInput, 'pet@example.com');

    expect(emailInput).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('blocks submission when the password does not meet the strength rule', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example.com');
    await user.type(screen.getByLabelText(/username/i), 'pat_sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'abcdef');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters and include lowercase, uppercase, number, and special characters.',
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('forwards the entered values and shows the confirmation message when no session is returned', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue({ user: { id: 'user-1' }, session: null });
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example.com');
    await user.type(screen.getByLabelText(/username/i), '  Pat_Sitter  ');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mutateAsync).toHaveBeenCalledWith({
      email: 'pet@example.com',
      username: 'pat_sitter',
      password: 'Password1!',
      displayName: 'Pat',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Check your email to confirm your account',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to /profile when signup returns a session', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ user: { id: 'user-1' }, session: { access_token: 'token' } });
    mockedUseSignUp.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/email/i), 'pet@example.com');
    await user.type(screen.getByLabelText(/username/i), 'pat_sitter');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.type(screen.getByLabelText(/display name/i), 'Pat');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("renders the mutation error's message when signup fails", () => {
    mockedUseSignUp.mockReturnValue(
      mutationResult({ isError: true, error: new SignUpError('EMAIL_ALREADY_USED') }),
    );
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('EMAIL_ALREADY_USED');
  });

  it.each<[SignUpErrorCode, RegExp]>([
    ['EMAIL_ALREADY_USED', /email/i],
    ['USERNAME_ALREADY_USED', /username/i],
    ['WEAK_PASSWORD', /^password$/i],
  ])('attaches a %s rejection to the field that caused it', (code, label) => {
    mockedUseSignUp.mockReturnValue(
      mutationResult({ isError: true, error: new SignUpError(code) }),
    );
    renderForm();

    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(code);
    expect(screen.getByRole('alert')).toHaveTextContent(code);
  });

  it('leaves every field unmarked when the rejection names no field', () => {
    mockedUseSignUp.mockReturnValue(
      mutationResult({ isError: true, error: new SignUpError('RATE_LIMITED') }),
    );
    renderForm();

    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/username/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('RATE_LIMITED');
  });

  it('renders a generic fallback message when the failure is not a SignUpError', () => {
    mockedUseSignUp.mockReturnValue(
      mutationResult({ isError: true, error: new Error('Network error') }),
    );
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't create your account. Please try again.",
    );
  });

  it('disables the submit button while the request is pending', () => {
    mockedUseSignUp.mockReturnValue(mutationResult({ isPending: true }));
    renderForm();

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });
});
