/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LogoutButton } from './LogoutButton';
import { useAuth } from '../hooks/useAuth';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);

function renderLogoutButton(props = {}) {
  return render(
    <MemoryRouter>
      <LogoutButton {...props} />
    </MemoryRouter>,
  );
}

describe('LogoutButton and LogoutConfirmDialog', () => {
  let mockSignOut: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
      session: { access_token: 'fake-token' },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('renders button with default label and does not show dialog initially', () => {
    renderLogoutButton();

    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders custom children when provided', () => {
    renderLogoutButton({ children: <span>Sign Out Now</span> });

    expect(screen.getByRole('button', { name: /sign out now/i })).toBeInTheDocument();
  });

  it('opens confirmation dialog when button is clicked', async () => {
    const user = userEvent.setup();
    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Are you sure you want to log out of your account?')).toBeInTheDocument();
  });

  it('closes dialog without calling signOut when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('closes dialog without calling signOut when Escape key is pressed', async () => {
    const user = userEvent.setup();
    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('calls signOut and redirects to /login on confirmation', async () => {
    const user = userEvent.setup();
    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];

    await user.click(confirmButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('supports custom redirect destination', async () => {
    const user = userEvent.setup();
    renderLogoutButton({ redirectTo: '/' });

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];

    await user.click(confirmButton);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('disables action buttons and displays pending state during signOut', async () => {
    const user = userEvent.setup();
    let resolveSignOut!: () => void;
    mockSignOut.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];
    const cancelButton = screen.getByRole('button', { name: /cancel/i });

    await user.click(confirmButton);

    expect(screen.getByText('Logging out...')).toBeInTheDocument();
    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();

    // Resolve promise
    resolveSignOut();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('displays error message when signOut fails', async () => {
    const user = userEvent.setup();
    mockSignOut.mockRejectedValue(new Error('Network error during sign out'));

    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];

    await user.click(confirmButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error during sign out');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('closes dialog when backdrop overlay is clicked', async () => {
    const user = userEvent.setup();
    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const backdrop = screen.getByTestId('logout-dialog-backdrop');
    await user.click(backdrop);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('prevents backdrop click and Escape dismissal while logout is in flight', async () => {
    const user = userEvent.setup();
    let resolveSignOut!: () => void;
    mockSignOut.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      }),
    );

    renderLogoutButton();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];
    await user.click(confirmButton);

    expect(screen.getByText('Logging out...')).toBeInTheDocument();

    // Attempt Escape
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Attempt Backdrop click
    const backdrop = screen.getByTestId('logout-dialog-backdrop');
    await user.click(backdrop);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    resolveSignOut();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('executes custom onConfirm callback when provided and closes dialog on success', async () => {
    const user = userEvent.setup();
    const mockCustomConfirm = jest.fn().mockResolvedValue(undefined);

    renderLogoutButton({ onConfirm: mockCustomConfirm });

    await user.click(screen.getByRole('button', { name: /log out/i }));
    const confirmButton = screen.getAllByRole('button', { name: /log out/i })[1];

    await user.click(confirmButton);

    expect(mockCustomConfirm).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
