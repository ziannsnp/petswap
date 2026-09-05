import { useState, type FormEvent } from 'react';
import { PawPrint } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSignUp } from '../hooks/useSignUp';
import { SignUpError } from '../lib/authApi';

export function RegisterForm() {
  const navigate = useNavigate();
  const signUpMutation = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    setConfirmationSent(false);

    if (!email.trim() || !password || !displayName.trim()) {
      setValidationError('Complete all required fields.');
      return;
    }

    if (!acceptedTerms) {
      setValidationError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }

    try {
      const { session } = await signUpMutation.mutateAsync({ email, password, displayName });

      if (session) {
        void navigate('/profile', { replace: true });
      } else {
        setConfirmationSent(true);
      }
    } catch {
      // The mutation exposes its translated error below.
    }
  }

  const requestError =
    signUpMutation.error instanceof SignUpError
      ? signUpMutation.error.message
      : signUpMutation.isError
        ? "We couldn't create your account. Please try again."
        : null;

  const errorMessage = validationError ?? requestError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-4 py-8">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <PawPrint className="h-12 w-12 text-brand-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Don't Like My Pets</h1>
          <p className="text-gray-500 mt-1">A marketplace for trusted pet sitting</p>
        </div>

        <h2 className="text-lg font-semibold text-gray-900">Create your account</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="input-field"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="input-field"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              className="input-field"
              autoComplete="name"
              required
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              id="consent"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="consent" className="text-sm text-gray-600">
              I agree to the Terms of Service and{' '}
              <Link to="/privacy" className="text-brand-600 underline">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          )}

          {confirmationSent && (
            <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
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
