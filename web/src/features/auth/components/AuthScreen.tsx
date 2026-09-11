import { PawPrint } from 'lucide-react';
import { Link } from 'react-router-dom';

// Entry point for signed-out visitors. FR-1.1's signIn adapter exists, but no login
// form consumes it yet, so this screen only routes people to registration for now.
export function AuthScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 px-4 py-8">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <PawPrint className="h-12 w-12 text-brand-600 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Don't Like My Pets</h1>
        <p className="text-gray-500 mt-1">A marketplace for trusted pet sitting</p>

        <p className="mt-8 text-sm text-gray-600">
          Signing in with a username or email is not available yet.
        </p>

        <Link to="/register" className="btn-primary mt-4 inline-block w-full">
          Create an account
        </Link>
      </div>
    </div>
  );
}
