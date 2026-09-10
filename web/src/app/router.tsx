import { createBrowserRouter } from 'react-router-dom';
import { AuthScreen, ProtectedRoute, RegisterScreen } from '@/features/auth';
import { BookingsScreen } from '@/features/bookings';
import { CreateListingScreen, ListingsScreen } from '@/features/listings';
import { PrivacyNoticeScreen, TermsOfServiceScreen } from '@/features/consent';
import { PetsScreen } from '@/features/pets';
import { ProfileScreen } from '@/features/profiles';
import { SearchScreen } from '@/features/search';
import { NotFoundScreen } from '@/shared/components/NotFoundScreen';

export const router = createBrowserRouter([
  // Public routes
  { path: '/', Component: SearchScreen },
  { path: '/login', Component: AuthScreen },
  { path: '/register', Component: RegisterScreen },
  { path: '/privacy', Component: PrivacyNoticeScreen },
  { path: '/terms', Component: TermsOfServiceScreen },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/profile', Component: ProfileScreen },
      { path: '/pets', Component: PetsScreen },
      { path: '/listings', Component: ListingsScreen },
      { path: '/listings/new', Component: CreateListingScreen },
      { path: '/bookings', Component: BookingsScreen },
    ],
  },

  // Catch-all route
  { path: '*', Component: NotFoundScreen },
]);
