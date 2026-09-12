import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Heart,
  Home,
  LogIn,
  LogOut,
  Menu,
  PawPrint,
  Search,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth, LogoutConfirmDialog } from '@/features/auth';

const PROTECTED_NAV_ITEMS = [
  { to: '/', label: 'Search', Icon: Search, end: true },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDays, end: false },
  { to: '/listings', label: 'My listings', Icon: Home, end: false },
  { to: '/pets', label: 'Pets', Icon: Heart, end: false },
];

export function Navbar() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    'User';

  const userInitials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8"
        aria-label="Primary navigation"
      >
        {/* Brand Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="PetSwap home">
          <PawPrint className="h-8 w-8 text-brand-600" aria-hidden="true" />
          <span className="text-xl font-bold text-brand-700">PetSwap</span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="ml-auto hidden h-full min-w-0 items-stretch md:flex">
          {isAuthenticated ? (
            PROTECTED_NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-w-12 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors lg:min-w-24 lg:px-3 ${
                    isActive
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-transparent text-gray-500 hover:bg-brand-50 hover:text-brand-700'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))
          ) : (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex min-w-12 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors lg:min-w-24 lg:px-3 ${
                  isActive
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-transparent text-gray-500 hover:bg-brand-50 hover:text-brand-700'
                }`
              }
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">Search</span>
            </NavLink>
          )}
        </div>

        {/* Desktop Right Side Controls */}
        <div className="ml-2 hidden items-center gap-3 md:flex">
          {isLoading ? (
            <div className="flex items-center gap-2" data-testid="navbar-loading">
              <div className="h-9 w-20 animate-pulse rounded-lg bg-gray-200" />
            </div>
          ) : isAuthenticated ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-gray-600 hover:text-brand-600"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Account menu"
                title={displayName}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {userInitials || <User className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="text-sm font-medium">Account</span>
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-100 bg-white shadow-lg"
                >
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-brand-50"
                  >
                    Edit profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setIsLogoutDialogOpen(true);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Log in</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-xs hover:bg-brand-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="ml-auto flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle main menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="border-b border-gray-200 bg-white px-4 pt-2 pb-4 md:hidden" data-testid="mobile-menu">
          <div className="space-y-1 pb-3">
            {isAuthenticated ? (
              PROTECTED_NAV_ITEMS.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))
            ) : (
              <NavLink
                to="/"
                end
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Search</span>
              </NavLink>
            )}
          </div>

          <div className="border-t border-gray-200 pt-3">
            {isLoading ? (
              <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
            ) : isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                    {userInitials || <User className="h-4 w-4" aria-hidden="true" />}
                  </div>
                  <span className="truncate">{displayName}</span>
                </Link>
                <div className="px-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsLogoutDialogOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Log in</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <LogoutConfirmDialog isOpen={isLogoutDialogOpen} onClose={() => setIsLogoutDialogOpen(false)} />
    </header>
  );
}
