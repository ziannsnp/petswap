import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, PawPrint } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignUp } from '../hooks/useSignUp';
import { SignUpError } from '../lib/authApi';
import { EMAIL_REQUIREMENTS_MESSAGE, isValidEmail, normalizeEmail } from '../lib/email';
import {
  isValidUsername,
  normalizeUsername,
  USERNAME_REQUIREMENTS_MESSAGE,
} from '../lib/username';
import { isValidPassword, PASSWORD_REQUIREMENTS_MESSAGE } from '../lib/password';
import type { SignUpErrorCode } from '../types';

const CONSENT_REQUIRED_MESSAGE = 'You must accept the Terms of Service and Privacy Policy.';
const INCOMPLETE_MESSAGE = 'Complete all required fields.';
const GENERIC_FAILURE_MESSAGE = "We couldn't create your account. Please try again.";

type FieldName = 'email' | 'username' | 'password' | 'displayName' | 'acceptedTerms';
type FieldErrors = Partial<Record<FieldName, string>>;

// A rejection the server alone can detect still belongs beside the field that caused
// it, so the user is not left rereading a summary to work out which input to change.
const SERVER_ERROR_FIELD: Partial<Record<SignUpErrorCode, FieldName>> = {
  EMAIL_ALREADY_USED: 'email',
  INVALID_EMAIL: 'email',
  USERNAME_ALREADY_USED: 'username',
  INVALID_USERNAME: 'username',
  WEAK_PASSWORD: 'password',
};

interface RegistrationValues {
  email: string;
  username: string;
  password: string;
  displayName: string;
  acceptedTerms: boolean;
}

function collectFieldErrors(values: RegistrationValues): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  const username = values.username.trim();
  const displayName = values.displayName.trim();

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!isValidEmail(email)) {
    errors.email = EMAIL_REQUIREMENTS_MESSAGE;
  }

  if (!username) {
    errors.username = 'Choose a username.';
  } else if (!isValidUsername(username)) {
    errors.username = USERNAME_REQUIREMENTS_MESSAGE;
  }

  if (!values.password) {
    errors.password = 'Enter a password.';
  } else if (!isValidPassword(values.password)) {
    errors.password = PASSWORD_REQUIREMENTS_MESSAGE;
  }

  if (!displayName) {
    errors.displayName = 'Enter a display name.';
  }

  if (!values.acceptedTerms) {
    errors.acceptedTerms = CONSENT_REQUIRED_MESSAGE;
  }

  return errors;
}

// The summary names one problem at a time. An empty form reports that it is empty
// rather than repeating the same sentence for every field; once the fields are
// filled it reports the first that is actually malformed.
function summarize(values: RegistrationValues, errors: FieldErrors): string | null {
  const isIncomplete =
    !values.email.trim() || !values.username.trim() || !values.password || !values.displayName.trim();

  if (isIncomplete) {
    return INCOMPLETE_MESSAGE;
  }

  return errors.email ?? errors.username ?? errors.password ?? errors.acceptedTerms ?? null;
}

export function RegisterForm() {
  const navigate = useNavigate();
  const signUpMutation = useSignUp();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  // Editing a field retracts the complaint about it; leaving it visible while the
  // user is fixing it reads as though the fix did not register.
  function clearFieldError(field: FieldName) {
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
    setConfirmationSent(false);

    const values: RegistrationValues = { email, username, password, displayName, acceptedTerms };
    const errors = collectFieldErrors(values);
    const summary = summarize(values, errors);

    setFieldErrors(errors);
    setValidationSummary(summary);

    if (summary) {
      return;
    }

    try {
      const { session } = await signUpMutation.mutateAsync({
        email: normalizeEmail(email),
        username: normalizeUsername(username),
        password,
        displayName: displayName.trim(),
      });

      if (session) {
        void navigate('/profile', { replace: true });
      } else {
        setConfirmationSent(true);
      }
    } catch {
      // The mutation exposes its translated error below.
    }
  }

  const signUpError = signUpMutation.error instanceof SignUpError ? signUpMutation.error : null;
  const requestError = signUpError
    ? signUpError.message
    : signUpMutation.isError
      ? GENERIC_FAILURE_MESSAGE
      : null;

  // A server rejection outranks a stale client message: it describes the attempt
  // the user just made, while the client errors were cleared as they typed.
  const serverErrorField = signUpError?.code ? SERVER_ERROR_FIELD[signUpError.code] : undefined;
  const visibleErrors: FieldErrors =
    serverErrorField && signUpError
      ? { ...fieldErrors, [serverErrorField]: signUpError.message }
      : fieldErrors;

  const summaryMessage = validationSummary ?? requestError;

  function describedBy(field: FieldName, ...extra: string[]): string | undefined {
    const ids = [...extra];
    if (visibleErrors[field]) {
      ids.unshift(`${field}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : undefined;
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

        <h2 className="text-lg font-semibold text-gray-900">Create your account</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
          <div>
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError('email');
              }}
              placeholder="your@email.com"
              className={inputClass('email')}
              autoComplete="email"
              aria-invalid={visibleErrors.email ? true : undefined}
              aria-describedby={describedBy('email')}
              required
            />
            {visibleErrors.email && (
              <p id="email-error" className="form-error">
                {visibleErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                clearFieldError('username');
              }}
              placeholder="your_username"
              className={inputClass('username')}
              autoComplete="username"
              aria-invalid={visibleErrors.username ? true : undefined}
              aria-describedby={describedBy('username', 'username-requirements')}
              required
            />
            {visibleErrors.username ? (
              <p id="username-error" className="form-error">
                {visibleErrors.username}
              </p>
            ) : (
              <p id="username-requirements" className="form-hint">
                3–30 characters: letters, numbers, and underscores. Saved in lowercase.
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
                placeholder="••••••••"
                className={`${inputClass('password')} pr-11`}
                autoComplete="new-password"
                aria-invalid={visibleErrors.password ? true : undefined}
                aria-describedby={describedBy('password', 'password-requirements')}
                minLength={8}
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
            {visibleErrors.password ? (
              <p id="password-error" className="form-error">
                {visibleErrors.password}
              </p>
            ) : (
              <p id="password-requirements" className="form-hint">
                At least 8 characters with lowercase, uppercase, number, and special characters.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="displayName" className="form-label">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                clearFieldError('displayName');
              }}
              placeholder="Your name"
              className={inputClass('displayName')}
              autoComplete="name"
              aria-invalid={visibleErrors.displayName ? true : undefined}
              aria-describedby={describedBy('displayName')}
              required
            />
            {visibleErrors.displayName && (
              <p id="displayName-error" className="form-error">
                {visibleErrors.displayName}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-start gap-2">
              <input
                id="consent"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked);
                  clearFieldError('acceptedTerms');
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                aria-invalid={visibleErrors.acceptedTerms ? true : undefined}
                aria-describedby={describedBy('acceptedTerms')}
              />
              <label htmlFor="consent" className="text-sm text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-brand-600 underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-brand-600 underline">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>
            {visibleErrors.acceptedTerms && (
              <p id="acceptedTerms-error" className="form-error">
                {visibleErrors.acceptedTerms}
              </p>
            )}
          </div>

          {summaryMessage && (
            <p role="alert" className="form-alert">
              {summaryMessage}
            </p>
          )}

          {confirmationSent && (
            <p role="status" className="form-status">
              Account created. Check your email to confirm your account before signing in.
            </p>
          )}

          <button
            type="submit"
            className="w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={signUpMutation.isPending || confirmationSent}
          >
            {signUpMutation.isPending ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
