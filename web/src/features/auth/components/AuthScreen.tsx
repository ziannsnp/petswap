import { useLocation, useNavigate } from 'react-router-dom';
import { RegisterForm } from './RegisterForm';

function isDevEnvironment(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.endsWith('.local'))
    );
  } catch {
    return false;
  }
}

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? '/bookings';

  const handleDevSignIn = () => {
    localStorage.setItem('petswap_dev_mock_session', 'true');
    navigate(from, { replace: true });
    window.location.reload();
  };

  return (
    <div>
      {isDevEnvironment() && (
        <div className="mx-auto my-6 max-w-md rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                🛠️ Dev Demo Mode
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Supabase email rate limited? Sign in as a demo user to test booking management.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDevSignIn}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-brand-700 transition-colors shrink-0 cursor-pointer"
            >
              Sign in as Demo User &rarr;
            </button>
          </div>
        </div>
      )}
      <RegisterForm />
    </div>
  );
}