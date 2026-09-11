/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthScreen } from './AuthScreen';
import { useSignIn } from '../hooks/useSignIn';
import { SignInError } from '../lib/authApi';
import type { SignInErrorCode } from '../types';

const mockNavigate = jest.fn();
let locationState: unknown = null;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/login', state: locationState }),
}));

// Factory form avoids loading the real modules, which transitively hit import.meta.env.
jest.mock('../hooks/useSignIn', () => ({ useSignIn: jest.fn() }));
jest.mock('../lib/authApi', () => ({
  // Skips the real code->message lookup table; that translation is covered by authApi.test.ts.
  SignInError: class SignInError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'SignInError';
      // The real class carries the code alongside the message; the form routes on it.
      this.code = code;
    }
  },
}));

const mockedUseSignIn = jest.mocked(useSignIn);

function renderForm() {
  return render(
    <MemoryRouter>
      <AuthScreen />
    </MemoryRouter>,
  );
}

function mutationResult(overrides: Partial<ReturnType<typeof useSignIn>> = {}) {
  return {
    mutateAsync: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as ReturnType<typeof useSignIn>;
}

function signInError(code: SignInErrorCode) {
  return new (SignInError as unknown as new (code: string) => Error)(code);
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  values: { identifier: string; password: string },
) {
  if (values.identifier) {
    await user.type(screen.getByLabelText(/email or username/i), values.identifier);
  }
  if (values.password) {
    await user.type(screen.getByLabelText(/^password$/i), values.password);
  }
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('AuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationState = null;
    mockedUseSignIn.mockReturnValue(mutationResult());
  });

  it('names the product so a signed-out visitor knows where they are', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: /don't like my pets/i })).toBeInTheDocument();
  });

  // FR-1.1 accepts either credential, so the field must not be labelled or typed as
  // an email address alone — a username has to be enterable here too.
  it('offers one field that accepts an email address or a username', () => {
    renderForm();

    const identifier = screen.getByLabelText(/email or username/i);

    expect(identifier).toBeInTheDocument();
    expect(identifier).toHaveAttribute('type', 'text');
  });

  // Revealing the password is a deliberate escape hatch from typing blind; the toggle
  // has to change the input's type, not merely its own label.
  it('reveals and re-hides the password on request', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
  });

  // ProtectedRoute sends unauthenticated users here, so this link is still the only
  // route to registration from inside the app.
  it('offers a way to reach registration', () => {
    renderForm();

    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('blocks submission and reports an empty form once, not once per field', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Complete all required fields.');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks submission when only the password is missing', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: '' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Complete all required fields.');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('aria-invalid', 'true');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  // An identifier holding an '@' is an address, so it is held to the address rule.
  it('rejects a malformed email address before reaching the network', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat@example', password: 'Password1!' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address or username.',
    );
    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  // Without an '@' it is a username, so it is held to the username rule instead.
  it('rejects a malformed username before reaching the network', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pa t', password: 'Password1!' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a valid email address or username.',
    );
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  // The strength rules govern registration, not sign-in: an account made under an
  // older policy must still be able to reach the server and be judged there.
  it('does not hold an existing password to the registration strength rules', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'weak' });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ identifier: 'pat_sitter', password: 'weak' });
    });
  });

  it('trims the identifier before sending it', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: '  pat@example.com  ', password: 'Password1!' });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        identifier: 'pat@example.com',
        password: 'Password1!',
      });
    });
  });

  it('returns the visitor to the protected page that sent them here', async () => {
    const user = userEvent.setup();
    locationState = { from: { pathname: '/bookings' } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/bookings', { replace: true });
    });
  });

  // A protocol-relative path is a valid pathname to the router and an off-site
  // redirect to the browser, so a successful sign-in must not follow one.
  it('ignores a recorded destination that would leave the site', async () => {
    const user = userEvent.setup();
    locationState = { from: { pathname: '//example.com/phish' } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });
  });

  // FR-1.1 requires safe errors: naming which half was wrong would confirm that an
  // account exists for the identifier that was entered.
  it('does not blame either field for rejected credentials', async () => {
    mockedUseSignIn.mockReturnValue(
      mutationResult({ isError: true, error: signInError('INVALID_CREDENTIALS') }),
    );
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('INVALID_CREDENTIALS');
    expect(screen.getByLabelText(/email or username/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^password$/i)).not.toHaveAttribute('aria-invalid');
  });

  it('attaches a rejection the server could attribute to the field it names', () => {
    mockedUseSignIn.mockReturnValue(
      mutationResult({ isError: true, error: signInError('INVALID_IDENTIFIER') }),
    );
    renderForm();

    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^password$/i)).not.toHaveAttribute('aria-invalid');
  });

  it('retracts a complaint once the visitor edits the field it named', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email or username/i), 'p');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email or username/i)).not.toHaveAttribute('aria-invalid');
  });

  // signIn() throws INVALID_IDENTIFIER for exactly the input the visitor is now
  // correcting, so -- unlike an unattributed rejection such as RATE_LIMITED -- typing
  // into that field answers it and the mutation has to be reset, not just the local
  // field-error state, or the server's message stays attached to the input for good.
  it('retracts a server rejection once the visitor edits the field it named', async () => {
    const user = userEvent.setup();
    rejectingMutation('INVALID_IDENTIFIER');
    renderForm();

    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText(/email or username/i), 'a_different_name');

    expect(screen.getByLabelText(/email or username/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a server rejection while the visitor edits a different field', async () => {
    const user = userEvent.setup();
    rejectingMutation('INVALID_IDENTIFIER');
    renderForm();

    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');

    // The identifier is still whatever the server rejected; editing an unrelated field
    // fixed nothing about it.
    expect(screen.getByLabelText(/email or username/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks a second submission while the first is in flight', () => {
    mockedUseSignIn.mockReturnValue(mutationResult({ isPending: true }));
    renderForm();

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  // Typing does not answer 'confirm your address' or 'too many attempts', so a
  // keystroke must not wipe a message that is still true and leave nothing behind.
  it('keeps a server rejection on screen while the visitor edits the form', async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    mockedUseSignIn.mockReturnValue(
      mutationResult({ isError: true, error: signInError('EMAIL_NOT_CONFIRMED'), reset }),
    );
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('EMAIL_NOT_CONFIRMED');

    await user.type(screen.getByLabelText(/email or username/i), 'p');
    await user.type(screen.getByLabelText(/^password$/i), 'p');

    expect(screen.getByRole('alert')).toHaveTextContent('EMAIL_NOT_CONFIRMED');
    expect(reset).not.toHaveBeenCalled();
  });

  // ProtectedRoute records the whole location, so a visitor interrupted on a filtered,
  // scrolled page has to land back on that view rather than its root.
  it('restores the query and fragment of the page that sent them here', async () => {
    const user = userEvent.setup();
    locationState = { from: { pathname: '/listings/abc', search: '?tab=reviews', hash: '#photos' } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/listings/abc?tab=reviews#photos', {
        replace: true,
      });
    });
  });

  // The browser normalizes the backslash to a slash, turning this into the same
  // protocol-relative reference as '//example.com'.
  it('ignores a recorded destination that smuggles in a host via a backslash', async () => {
    const user = userEvent.setup();
    // String.raw keeps the backslash literal; a plain quoted '\e' would collapse to
    // 'e' and quietly test an ordinary in-app path instead.
    locationState = { from: { pathname: String.raw`/\example.com/phish` } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });
  });

  // The character class after the leading slash requires something to follow it, so
  // the bare root path has nothing to match there and needs its own branch in the
  // pattern -- otherwise a visitor sent here from '/' lands on '/profile' instead.
  it('returns to the site root when that is the page that sent them here', async () => {
    const user = userEvent.setup();
    locationState = { from: { pathname: '/' } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  // ProtectedRoute never wraps the auth screens, so it cannot record either as `from`
  // today -- this guards against a future change that starts passing this state from
  // the auth screens themselves and would otherwise bounce a successful sign-in
  // straight back to the form it was just submitted from.
  it('does not resume the login or registration screen itself', async () => {
    const user = userEvent.setup();
    locationState = { from: { pathname: '/register' } };
    const mutateAsync = jest.fn().mockResolvedValue({ user: {}, session: {} });
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });
  });

  it('stays on the form when sign-in is rejected', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockRejectedValue(new Error('rejected'));
    mockedUseSignIn.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await fillAndSubmit(user, { identifier: 'pat_sitter', password: 'Password1!' });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // A stateful mock: asserting only that reset() was called would pass against an
  // implementation that calls it and ignores the result, so the message has to be
  // observed actually going away and staying away.
  function rejectingMutation(code: SignInErrorCode) {
    let isError = true;
    const reset = jest.fn(() => {
      isError = false;
    });
    mockedUseSignIn.mockImplementation(() =>
      isError
        ? mutationResult({ isError: true, error: signInError(code), reset })
        : mutationResult({ isError: false, error: null, reset }),
    );
    return reset;
  }

  // The bug this guards: a submit rejected by client validation never reaches the
  // mutation, so the previous verdict stayed latent behind the validation summary and
  // came back on the next keystroke — making a keystroke look like it caused rate
  // limiting, and describing the attempt before last.
  it('retires a server rejection on a submit it rejects itself', async () => {
    const user = userEvent.setup();
    rejectingMutation('RATE_LIMITED');
    renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent('RATE_LIMITED');

    // Client-invalid: the password is left empty, so no request is made.
    await user.type(screen.getByLabelText(/email or username/i), 'pat_sitter');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Complete all required fields.');

    // The keystroke that clears the validation summary must not resurrect the rejection.
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
