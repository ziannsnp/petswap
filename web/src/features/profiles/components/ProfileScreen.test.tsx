/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileScreen } from './ProfileScreen';
import { useCurrentProfile } from '../hooks/useProfile';
import { useAuth } from '@/features/auth';
import type { Profile } from '../lib/profileApi';

jest.mock('../hooks/useProfile', () => ({
  useCurrentProfile: jest.fn(),
  useUpdateProfile: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
  useUploadAvatar: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
  useDeleteAvatar: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

jest.mock('@/features/auth', () => ({
  useAuth: jest.fn(),
}));

const mockUseCurrentProfile = useCurrentProfile as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const sampleProfile: Profile = {
  id: 'user-123',
  display_name: 'Somchai Petlover',
  username: 'somchai99',
  photo_url: 'https://example.com/photo.jpg',
  phone_number: '0812345678',
  location: 'Bangkok, Thailand',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  consent_version: '2026-09-05',
  consent_given_at: '2026-01-01T00:00:00.000Z',
};

describe('ProfileScreen UI (View & Edit mode layout)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-123',
        email: 'somchai@example.com',
      },
    });
  });

  it('renders loading skeleton when fetching profile data', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading your profile/i)).toBeInTheDocument();
  });

  it('renders error alert when fetching profile fails', () => {
    const refetchMock = jest.fn();
    mockUseCurrentProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load profile/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders an explicit missing-profile state instead of fabricated data when profile is null', () => {
    const refetchMock = jest.fn();
    mockUseCurrentProfile.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/profile not found/i)).toBeInTheDocument();
    expect(screen.queryByText(/alex rivera/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alex_rivera/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders View Mode by default with full user details', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: sampleProfile,
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    // Profile header and basic info
    expect(screen.getByRole('heading', { level: 1, name: 'Somchai Petlover' })).toBeInTheDocument();
    expect(screen.getAllByText('@somchai99').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('somchai@example.com')).toBeInTheDocument();
    expect(screen.getByText('0812345678')).toBeInTheDocument();
    expect(screen.getByText('Bangkok, Thailand')).toBeInTheDocument();

    // Edit profile action button is visible
    expect(screen.getByRole('button', { name: /edit your profile/i })).toBeInTheDocument();
  });

  it('shows initials instead of a broken image when the profile has no photo', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: { ...sampleProfile, photo_url: null },
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.queryByAltText('Somchai Petlover')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Somchai Petlover' })).toHaveTextContent('SP');
  });

  it('toggles to Edit Mode when clicking Edit Profile and returns on Cancel', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: sampleProfile,
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    // Click "Edit profile"
    const editButton = screen.getByRole('button', { name: /edit your profile/i });
    fireEvent.click(editButton);

    // Edit mode heading should now be rendered
    expect(screen.getByRole('heading', { level: 1, name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByText(/profile photo/i)).toBeInTheDocument();

    // Inputs populated in edit mode layout
    expect(screen.getByDisplayValue('Somchai Petlover')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0812345678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bangkok, Thailand')).toBeInTheDocument();

    // Click "Cancel" to return to View Mode
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Should be back to View Mode
    expect(screen.getByRole('heading', { level: 1, name: 'Somchai Petlover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit your profile/i })).toBeInTheDocument();
  });

  it('hides the Edit profile button when viewing another user profile', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: { ...sampleProfile, id: 'user-456' },
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Somchai Petlover' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit your profile/i })).not.toBeInTheDocument();
  });

  it('protects against editing another user profile when authenticated as a different user', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-different',
        email: 'different@example.com',
      },
    });
    mockUseCurrentProfile.mockReturnValue({
      data: sampleProfile,
      isLoading: false,
      isError: false,
    });

    render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Somchai Petlover' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit your profile/i })).not.toBeInTheDocument();
  });

  it('resets isEditing to false when profile id changes', () => {
    mockUseCurrentProfile.mockReturnValue({
      data: sampleProfile,
      isLoading: false,
      isError: false,
    });

    const { rerender } = render(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit your profile/i }));
    expect(screen.getByRole('heading', { level: 1, name: /edit profile/i })).toBeInTheDocument();

    // Profile changes to another user
    mockUseCurrentProfile.mockReturnValue({
      data: { ...sampleProfile, id: 'user-other', display_name: 'Other User' },
      isLoading: false,
      isError: false,
    });

    rerender(
      <MemoryRouter>
        <ProfileScreen />
      </MemoryRouter>
    );

    // Edit mode should be cleanly reset to view mode
    expect(screen.getByRole('heading', { level: 1, name: 'Other User' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /edit profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit your profile/i })).not.toBeInTheDocument();
  });
});
