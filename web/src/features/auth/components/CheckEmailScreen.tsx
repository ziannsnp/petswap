import { useEffect, useState } from 'react';
import { Mail, PawPrint } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useResendConfirmation } from '../hooks/useResendConfirmation';
import { ResendConfirmationError } from '../lib/authApi';
import { isValidEmail, normalizeEmail } from '../lib/email';

export const RESEND_COOLDOWN_SECONDS = 60;
const GENERIC_RESEND_ERROR = 'We could not resend the confirmation email. Please try again.';

interface CheckEmailLocationState {
  email?: string;
}

export function CheckEmailScreen() {
  const location = useLocation();
  const state = location.state as CheckEmailLocationState | null;
  const initialEmail = state?.email ? normalizeEmail(state.email) : '';

  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [cooldown, setCooldown] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resendMutation = useResendConfirmation();

  const isCooldownActive = cooldown > 0;

  useEffect(() => {
    if (!isCooldownActive) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCooldownActive]);

  const normalizedEmail = normalizeEmail(email);
  const canSend = Boolean(normalizedEmail && isValidEmail(normalizedEmail));

  async function handleResend() {
    if (cooldown > 0 || !canSend) return;

    setSuccessMessage(null);
    try {
      await resendMutation.mutateAsync(normalizedEmail);
      setSuccessMessage('Confirmation email resent! Please check your inbox or spam folder.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setIsEditingEmail(false);
    } catch {
      // resendMutation.error surfaces below
    }
  }

  const errorMessage = resendMutation.error instanceof ResendConfirmationError
    ? resendMutation.error.message
    : resendMutation.isError
      ? GENERIC_RESEND_ERROR
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-4 py-8 sm:py-12">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="text-center mb-6">
          <PawPrint className="h-12 w-12 text-brand-600 mx-auto mb-3" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">Don't Like My Pets</h1>
          <p className="text-gray-500 mt-1">A marketplace for trusted pet sitting</p>
        </div>

        <div className="mx-auto my-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Mail className="h-7 w-7" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold text-gray-900">Check your email</h2>

        {initialEmail && !isEditingEmail ? (
          <div className="mt-3 text-sm text-gray-600">
            <p>
              We sent a confirmation link to{' '}
              <strong className="font-semibold text-gray-900">{normalizedEmail}</strong>.
            </p>
            <p className="mt-1">
              Click the link in the email to activate your account before signing in.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsEditingEmail(true);
                setSuccessMessage(null);
                if (resendMutation.isError) resendMutation.reset();
              }}
              className="mt-2 text-xs font-medium text-brand-600 hover:underline"
            >
              Wrong email address?
            </button>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            <p>
              Check your inbox for a confirmation link to activate your account before signing in.
            </p>
            <div className="mt-4 text-left">
              <label htmlFor="resend-email" className="form-label">
                Email address
              </label>
              <input
                id="resend-email"
                type="email"
                className="input-field"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSuccessMessage(null);
                  if (resendMutation.isError) resendMutation.reset();
                }}
              />
            </div>
          </div>
        )}

        {successMessage && (
          <p role="status" className="form-status mt-4 text-left">
            {successMessage}
          </p>
        )}

        {errorMessage && (
          <p role="alert" className="form-alert mt-4 text-left">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => { void handleResend(); }}
            disabled={resendMutation.isPending || cooldown > 0 || !canSend}
          >
            {resendMutation.isPending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend email in ${cooldown}s`
                : 'Resend confirmation email'}
          </button>

          <Link to="/login" className="btn-secondary block w-full text-center">
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
