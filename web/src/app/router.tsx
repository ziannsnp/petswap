import { createBrowserRouter } from 'react-router-dom';
import { AuthScreen, ProtectedRoute } from '@/features/auth';
import { BookingsScreen } from '@/features/bookings';
import { ListingsScreen } from '@/features/listings';
import { PetsScreen } from '@/features/pets';
import { ProfileScreen } from '@/features/profiles';
import { SearchScreen } from '@/features/search';
import { NotFoundScreen } from '@/shared/components/NotFoundScreen';

export const router = createBrowserRouter([
  // Public routes
  { path: '/', Component: SearchScreen },
  { path: '/login', Component: AuthScreen },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/profile', Component: ProfileScreen },
      { path: '/pets', Component: PetsScreen },
      { path: '/listings', Component: ListingsScreen },
      { path: '/bookings', Component: BookingsScreen },
    ],
  },

  // Catch-all route
  { path: '*', Component: NotFoundScreen },
]);
// Hey a PR workflow testing is working properly?
