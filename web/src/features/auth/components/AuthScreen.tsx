import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, PawPrint } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSignIn } from '../hooks/useSignIn';
import { SignInError } from '../lib/authApi';
import { isValidEmail } from '../lib/email';
import { isValidUsername } from '../lib/username';
import type { SignInErrorCode } from '../types';

const IDENTIFIER_REQUIREMENTS_MESSAGE = 'Enter a valid email address or username.';
const INCOMPLETE_MESSAGE = 'Complete all required fields.';
const GENERIC_FAILURE_MESSAGE = "We couldn't sign you in. Please try again.";
const DEFAULT_DESTINATION = '/profile';

type FieldName = 'identifier' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

// Only the rejections that name a single field belong beside one. INVALID_CREDENTIALS
// is deliberately absent: which half was wrong is exactly what FR-1.1 forbids
// disclosing, so it stays in the summary where it accuses neither input.
const SERVER_ERROR_FIELD: Partial<Record<SignInErrorCode, FieldName>> = {
  INVALID_IDENTIFIER: 'identifier',
  PASSWORD_REQUIRED: 'password',
};

interface SignInValues {
  identifier: string;
  password: string;
}

function collectFieldErrors(values: SignInValues): FieldErrors {
  const errors: FieldErrors = {};
  const identifier = values.identifier.trim();

  // An '@' is what signIn() itself branches on, so the form validates the identifier
  // the same way: anything containing one has to be a well-formed address, and
  // anything else has to be a well-formed username.
  if (!identifier) {
    errors.identifier = 'Enter your email address or username.';
  } else if (identifier.includes('@') ? !isValidEmail(identifier) : !isValidUsername(identifier)) {
    errors.identifier = IDENTIFIER_REQUIREMENTS_MESSAGE;
  }

  // Checked for presence only. The strength rules in password.ts govern what a new
  // password may be, not what an existing one is: running them here would lock out an
  // account created under an older rule, and would advertise the current policy to
  // anyone who can reach the login page.
  if (!values.password) {
    errors.password = 'Enter your password.';
  }

  return errors;
}

// One problem at a time. An empty form reports that it is empty rather than repeating
// itself per field; once both are filled it reports the first that is malformed.
function summarize(values: SignInValues, errors: FieldErrors): string | null {
  if (!values.identifier.trim() || !values.password) {
    return INCOMPLETE_MESSAGE;
  }

  return errors.identifier ?? errors.password ?? null;
}

// A location is only in-app when its path is exactly '/', or begins with a single
// slash followed by something that is not another separator. Allowing the second
// character to be '/' or '\' hands the browser an authority instead of a path: it
// reads '//example.com' as protocol-relative, and normalizes '/\example.com' into
// exactly that. The bare '/' has nothing after the slash to test, so it needs its
// own branch rather than falling out of the character class.
const IN_APP_PATH_PATTERN = /^\/(?:$|[^/\\])/;

// A visitor who lands back on the screen that sent them here has not been resumed
// anywhere; only ProtectedRoute ever populates `from`, and it never wraps these two
// routes, so this should not be reachable today -- kept as a guard against a future
// change that starts passing this state from the auth screens themselves.
const AUTH_SCREEN_PATHS = new Set(['/login', '/register']);

// ProtectedRoute stores the whole location it interrupted so sign-in can resume it,
// which means the query and fragment are part of the destination: a visitor sent away
// from a filtered, scrolled page expects to come back to that page, not to its root.
function redirectDestination(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null)
    ?.from;

  if (
    typeof from?.pathname !== 'string' ||
    !IN_APP_PATH_PATTERN.test(from.pathname) ||
    AUTH_SCREEN_PATHS.has(from.pathname)
  ) {
    return DEFAULT_DESTINATION;
  }

  const search = typeof from.search === 'string' ? from.search : '';
  const hash = typeof from.hash === 'string' ? from.hash : '';

  return `${from.pathname}${search}${hash}`;
}

// Entry point for signed-out visitors, and where ProtectedRoute sends anyone who
// reaches a protected page without a session. FR-1.1 lets an account sign in with
// either credential, so the first field takes an email address or a username and
// signIn() in authApi.ts decides which it was.
export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const signInMutation = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [validationSummary, setValidationSummary] = useState<string | null>(null);

  // Editing a field retracts the complaint about it; leaving it visible while the user
  // is fixing it reads as though the fix did not register.
  //
  // A server rejection is retracted here only when it names the field being edited --
  // signIn() throws INVALID_IDENTIFIER and PASSWORD_REQUIRED for exactly the input the
  // user is now correcting, so typing answers it. Every other rejection outlives the
  // keystroke: 'Confirm your email address' and 'Too many attempts' stay true no matter
  // what is in the fields, and clearing them on any edit left the user resubmitting
  // into the same wall with nothing on screen to explain it. Those are retired only by
  // the next submit, whether it reaches the server or handleSubmit rejects it first.
  function clearFieldError(field: FieldName) {
    const rejectedCode =
      signInMutation.error instanceof SignInError ? signInMutation.error.code : undefined;
    const rejectedField = rejectedCode ? SERVER_ERROR_FIELD[rejectedCode] : undefined;
    if (signInMutation.isError && rejectedField === field) {
      signInMutation.reset();
    }

    setValidationSummary(null);
    setFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const values: SignInValues = { identifier, password };
    const errors = collectFieldErrors(values);

    setFieldErrors(errors);
    setValidationSummary(summarize(values, errors));

    // Gate on the errors themselves, not on the summary text: a field whose message
    // never reaches the summary must still block submission.
    if (Object.keys(errors).length > 0) {
      // Submitting retires the previous attempt's verdict, but a submit rejected here
      // never reaches the mutation that would clear it. Left in place it only hides
      // behind the validation summary, then resurfaces on the next keystroke — so a
      // stale 'Too many attempts' would read as though typing had caused it.
      if (signInMutation.isError) {
        signInMutation.reset();
      }
      return;
    }

    try {
      await signInMutation.mutateAsync({ identifier: identifier.trim(), password });
      void navigate(redirectDestination(location.state), { replace: true });
    } catch {
      // The mutation exposes its translated error below.
    }
  }

  const signInError = signInMutation.error instanceof SignInError ? signInMutation.error : null;
  const requestError = signInError
    ? signInError.message
    : signInMutation.isError
      ? GENERIC_FAILURE_MESSAGE
      : null;

  // A server rejection outranks a stale client message: it describes the attempt the
  // user just made, while the client errors were cleared as they typed.
  const serverErrorField = signInError?.code ? SERVER_ERROR_FIELD[signInError.code] : undefined;
  const visibleErrors: FieldErrors =
    serverErrorField && signInError
      ? { ...fieldErrors, [serverErrorField]: signInError.message }
      : fieldErrors;

  const summaryMessage = validationSummary ?? requestError;

  function describedBy(field: FieldName): string | undefined {
    return visibleErrors[field] ? `${field}-error` : undefined;
  }

  function inputClass(field: FieldName): string {
    return visibleErrors[field] ? 'input-field input-field--error' : 'input-field';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-4 py-8 sm:py-12">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <PawPrint className="h-12 w-12 text-brand-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Don't Like My Pets</h1>
          <p className="text-gray-500 mt-1">A marketplace for trusted pet sitting</p>
        </div>

        <h2 className="text-lg font-semibold text-gray-900">Sign in to your account</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
          <div>
            <label htmlFor="identifier" className="form-label">
              Email or username
            </label>
            {/* Deliberately type="text", not type="email": a username is equally valid
                here, and the browser would reject one as a malformed address. */}
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                clearFieldError('identifier');
              }}
              placeholder="Email address or username"
              className={inputClass('identifier')}
              autoComplete="username"
              aria-invalid={visibleErrors.identifier ? true : undefined}
              aria-describedby={describedBy('identifier')}
              required
            />
            {visibleErrors.identifier && (
              <p id="identifier-error" className="form-error">
                {visibleErrors.identifier}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError('password');
                }}
                placeholder="Password"
                className={`${inputClass('password')} pr-11`}
                autoComplete="current-password"
                aria-invalid={visibleErrors.password ? true : undefined}
                aria-describedby={describedBy('password')}
                required
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              >
                {passwordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {visibleErrors.password && (
              <p id="password-error" className="form-error">
                {visibleErrors.password}
              </p>
            )}
          </div>

          {summaryMessage && (
            <p role="alert" className="form-alert">
              {summaryMessage}
            </p>
          )}

          <button
            type="submit"
            className="w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={signInMutation.isPending}
          >
            {signInMutation.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
