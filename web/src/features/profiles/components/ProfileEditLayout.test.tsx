/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileEditLayout } from './ProfileEditLayout';
import { useUpdateProfile } from '../hooks/useProfile';
import type { Profile } from '../lib/profileApi';

jest.mock('../hooks/useProfile', () => ({
  useUpdateProfile: jest.fn(),
}));

const mockUseUpdateProfile = useUpdateProfile as jest.Mock;

const sampleProfile: Profile = {
  id: 'user-123',
  display_name: 'Somchai Petlover',
  username: 'somchai99',
  photo_url: null,
  phone_number: '0812345678',
  location: 'Bangkok, Thailand',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  consent_version: '2026-09-05',
  consent_given_at: '2026-01-01T00:00:00.000Z',
};

function renderLayout({
  profile = sampleProfile,
  email = 'somchai@example.com',
  onCancel = jest.fn(),
  onSave = jest.fn(),
}: Partial<{
  profile: Profile;
  email: string | null;
  onCancel: () => void;
  onSave: () => void;
}> = {}) {
  return render(
    <ProfileEditLayout profile={profile} email={email} onCancel={onCancel} onSave={onSave} />,
  );
}

describe('ProfileEditLayout', () => {
  let mutateAsync: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mutateAsync = jest.fn().mockResolvedValue(sampleProfile);
    mockUseUpdateProfile.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('pre-fills display name, phone number, and location from the profile', () => {
    renderLayout();

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Somchai Petlover');
    expect(screen.getByLabelText(/phone number/i)).toHaveValue('0812345678');
    expect(screen.getByLabelText(/^location/i)).toHaveValue('Bangkok, Thailand');
  });

  it('shows username and email as read-only, not as editable inputs', () => {
    renderLayout();

    expect(screen.getByText('@somchai99')).toBeInTheDocument();
    expect(screen.getByText('somchai@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('blocks submission and shows an error when display name is cleared', () => {
    renderLayout();

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/display name cannot be empty/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('blocks submission and shows an error for a malformed phone number', () => {
    renderLayout();

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/phone number must be/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('clears a field error once the visitor corrects that field', () => {
    renderLayout();

    const phoneInput = screen.getByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(screen.getByText(/phone number must be/i)).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: '0812345678' } });
    expect(screen.queryByText(/phone number must be/i)).not.toBeInTheDocument();
  });

  it('saves the sanitized values and calls onSave on success', async () => {
    const onSave = jest.fn();
    renderLayout({ onSave });

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: '  Somchai P.  ' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '081-234-5678' } });
    fireEvent.change(screen.getByLabelText(/^location/i), { target: { value: '  Bangkok  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await screen.findByRole('button', { name: /save changes/i });

    expect(mutateAsync).toHaveBeenCalledWith({
      display_name: 'Somchai P.',
      phone_number: '0812345678',
      location: 'Bangkok',
      photo_url: null,
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the mutation error message when the save fails', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: new Error('Network is offline.'),
    });

    renderLayout();

    expect(screen.getByRole('alert')).toHaveTextContent('Network is offline.');
  });

  it('shows a generic message when the save fails without an Error instance', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: true,
      error: 'boom',
    });

    renderLayout();

    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't save your changes. Please try again.");
  });

  it('disables Save and Cancel while the mutation is pending', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutateAsync,
      isPending: true,
      isError: false,
      error: null,
    });

    renderLayout();

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('calls onCancel without saving when Cancel is clicked', () => {
    const onCancel = jest.fn();
    renderLayout({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
