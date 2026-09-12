import { CalendarDays, Heart, Home, PawPrint, Search, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Search', Icon: Search },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDays },
  { to: '/listings', label: 'My listings', Icon: Home },
  { to: '/pets', label: 'Pets', Icon: Heart },
];

interface ProfileHeaderNavProps {
  displayName?: string;
  photoUrl?: string | null;
}

export function ProfileHeaderNav({ displayName, photoUrl }: ProfileHeaderNavProps) {
  const initials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'US';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xs">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6 lg:gap-6 lg:px-8"
        aria-label="Primary navigation"
      >
        <Link
          className="flex shrink-0 items-center gap-2 font-bold text-brand-700 hover:text-brand-800 transition-colors"
          to="/"
          aria-label="PetSwap home"
        >
          <PawPrint className="h-7 w-7" aria-hidden="true" />
          <span className="hidden text-xl sm:inline">PetSwap</span>
        </Link>

        <div className="ml-auto flex h-full min-w-0 items-stretch">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-w-12 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors lg:min-w-24 lg:px-3 ${
                  isActive
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-transparent text-gray-500 hover:bg-brand-50 hover:text-brand-700'
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </div>

        <Link
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-600 bg-brand-50 text-sm font-semibold text-brand-700 hover:bg-brand-100 sm:h-10 sm:w-10 transition-colors"
          to="/profile"
          aria-label="Your profile"
        >
          {photoUrl ? (
            <img src={photoUrl} alt={displayName ?? 'Profile'} className="h-full w-full object-cover" />
          ) : initials ? (
            <span>{initials}</span>
          ) : (
            <User className="h-5 w-5 text-brand-700" aria-hidden="true" />
          )}
        </Link>
      </nav>
    </header>
  );
}
