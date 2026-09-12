/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useAuth } from '@/features/auth';

jest.mock('@/features/auth', () => ({
  useAuth: jest.fn(),
  LogoutConfirmDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Confirm logout</div> : null,
}));

const mockedUseAuth = jest.mocked(useAuth);

function renderNavbar(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        signOut: jest.fn(),
      });
    });

    it('renders logo and public Search link', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: /petswap home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument();
    });

    it('renders Log in and Register action links', () => {
      renderNavbar();

      const loginLink = screen.getByRole('link', { name: /log in/i });
      const registerLink = screen.getByRole('link', { name: /register/i });

      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');

      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });

    it('does NOT render protected links or Logout button for unauthenticated users', () => {
      renderNavbar();

      expect(screen.queryByRole('link', { name: /bookings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /my listings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^pets$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /your profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    });

    it('opens mobile menu and renders unauthenticated actions on toggle', async () => {
      const user = userEvent.setup();
      renderNavbar();

      expect(screen.queryByTestId('mobile-menu')).not.toBeInTheDocument();

      const toggleButton = screen.getByRole('button', { name: /toggle main menu/i });
      await user.click(toggleButton);

      const mobileMenu = screen.getByTestId('mobile-menu');
      expect(mobileMenu).toBeInTheDocument();

      // Mobile menu should contain Search, Log in, and Register
      expect(screen.getAllByRole('link', { name: /search/i })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: /log in/i })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: /register/i })).toHaveLength(2);
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: {
          id: 'user-123',
          email: 'liger@example.com',
          user_metadata: { display_name: 'Liger PetOwner' },
        },
        session: { access_token: 'fake-token' },
        isAuthenticated: true,
        isLoading: false,
        error: null,
        signOut: jest.fn(),
      } as unknown as ReturnType<typeof useAuth>);
    });

    it('renders all protected navigation links', () => {
      renderNavbar();

      expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /bookings/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /my listings/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^pets$/i })).toBeInTheDocument();
    });

    it('renders an account menu button and no visible profile/logout links by default', () => {
      renderNavbar();

      expect(screen.getByTitle('Liger PetOwner')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /edit profile/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    });

    it('opens the account menu to reveal Edit profile and Log out, matching the prototype layout', async () => {
      const user = userEvent.setup();
      renderNavbar();

      await user.click(screen.getByRole('button', { name: /account menu/i }));

      const profileLink = screen.getByRole('menuitem', { name: /edit profile/i });
      expect(profileLink).toBeInTheDocument();
      expect(profileLink).toHaveAttribute('href', '/profile');

      expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
    });

    it('opens the logout confirmation dialog when Log out is chosen from the account menu', async () => {
      const user = userEvent.setup();
      renderNavbar();

      await user.click(screen.getByRole('button', { name: /account menu/i }));
      await user.click(screen.getByRole('menuitem', { name: /log out/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does NOT render Log in or Register links when authenticated', () => {
      renderNavbar();

      expect(screen.queryByRole('link', { name: /^log in$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^register$/i })).not.toBeInTheDocument();
    });

    it('opens mobile menu and renders protected items & Logout button', async () => {
      const user = userEvent.setup();
      renderNavbar();

      const toggleButton = screen.getByRole('button', { name: /toggle main menu/i });
      await user.click(toggleButton);

      const mobileMenu = screen.getByTestId('mobile-menu');
      expect(mobileMenu).toBeInTheDocument();

      expect(screen.getAllByRole('link', { name: /bookings/i })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: /my listings/i })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: /^pets$/i })).toHaveLength(2);
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('renders loading skeleton when auth is loading', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        signOut: jest.fn(),
      });

      renderNavbar();

      expect(screen.getByTestId('navbar-loading')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    });
  });
});
