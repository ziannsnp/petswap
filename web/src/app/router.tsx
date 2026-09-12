import { createBrowserRouter } from 'react-router-dom';
import { AuthScreen, ProtectedRoute, RegisterScreen } from '@/features/auth';
import { BookingsScreen } from '@/features/bookings';
import { CreateListingScreen, ListingDetailScreen, ListingsScreen } from '@/features/listings';
import { PrivacyNoticeScreen, TermsOfServiceScreen } from '@/features/consent';
import { PetsScreen } from '@/features/pets';
import { ProfileScreen } from '@/features/profiles';
import { SearchScreen } from '@/features/search';
import { MainLayout, NotFoundScreen } from '@/shared/components';

export const router = createBrowserRouter([
  // Full-screen auth pages (without top Navbar)
  { path: '/login', Component: AuthScreen },
  { path: '/register', Component: RegisterScreen },

  // App routes wrapped in MainLayout (with Navbar)
  {
    element: <MainLayout />,
    children: [
      // Public routes
      { path: '/', Component: SearchScreen },
      { path: '/privacy', Component: PrivacyNoticeScreen },
      { path: '/terms', Component: TermsOfServiceScreen },
      { path: '/listings/:listingId', Component: ListingDetailScreen },

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
    ],
  },
]);


