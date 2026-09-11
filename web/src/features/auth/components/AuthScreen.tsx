import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, PawPrint } from 'lucide-react';
import { Link } from 'react-router-dom';

// Entry point for signed-out visitors, and where ProtectedRoute sends anyone who
// reaches a protected page without a session. FR-1.1 lets an account sign in with
// either credential, so the first field takes an email address or a username and
// signIn() in authApi.ts decides which it was.
export function AuthScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  // The form collects credentials but cannot spend them yet: validation and the
  // useSignIn wiring are the next commits on this branch. Submitting is still
  // intercepted so the browser does not navigate away and discard what was typed.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="your@email.com or your_username"
              className="input-field"
              autoComplete="username"
              required
            />
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
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="input-field pr-11"
                autoComplete="current-password"
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
          </div>

          <button type="submit" className="w-full btn-primary">
            Sign in
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
