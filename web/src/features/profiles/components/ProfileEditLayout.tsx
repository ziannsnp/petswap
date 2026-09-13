import { useState, type FormEvent } from 'react';
import { ArrowLeft, AtSign, Camera, Mail } from 'lucide-react';
import { useUpdateProfile } from '../hooks/useProfile';
import { validateProfileForm, type ProfileValidationErrors } from '../lib/profileValidation';
import type { Profile } from '../lib/profileApi';

interface ProfileEditLayoutProps {
  profile: Profile;
  email?: string | null;
  onCancel: () => void;
  onSave?: () => void;
}

const GENERIC_FAILURE_MESSAGE = "We couldn't save your changes. Please try again.";

export function ProfileEditLayout({ profile, email, onCancel, onSave }: ProfileEditLayoutProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [fieldErrors, setFieldErrors] = useState<ProfileValidationErrors>({});
  const updateProfileMutation = useUpdateProfile();

  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile.display_name || profile.username || 'User',
  )}&background=0d9488&color=fff&size=160`;

  function clearFieldError(field: keyof ProfileValidationErrors) {
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = validateProfileForm({
      displayName,
      phoneNumber,
      location,
      photoUrl: profile.photo_url,
    });

    if (!result.isValid) {
      setFieldErrors(result.errors);
      return;
    }

    setFieldErrors({});

    try {
      await updateProfileMutation.mutateAsync({
        display_name: result.sanitizedValues.displayName,
        phone_number: result.sanitizedValues.phoneNumber,
        location: result.sanitizedValues.location,
        photo_url: result.sanitizedValues.photoUrl,
      });
      onSave?.();
    } catch {
      // Surfaced below via updateProfileMutation.error.
    }
  }

  const requestError = updateProfileMutation.isError
    ? updateProfileMutation.error instanceof Error
      ? updateProfileMutation.error.message
      : GENERIC_FAILURE_MESSAGE
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      {/* Header with back/cancel action */}
      <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/70 hover:text-gray-900 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Back to profile view"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Edit Profile</h1>
              <p className="text-xs text-gray-500">Update your public profile details and contact information</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 space-y-8">
        {/* Profile Photo Layout Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-gray-100">
          <div className="relative group">
            <img
              src={profile.photo_url || avatarFallback}
              alt={profile.display_name}
              className="h-28 w-28 rounded-full border-2 border-gray-200 bg-gray-50 object-cover shadow-xs"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = avatarFallback;
              }}
            />
            <div
              className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-2 text-white shadow-md hover:bg-brand-700 transition-colors"
              title="Change profile photo"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-base font-semibold text-gray-900">Profile Photo</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Your photo appears on your profile and booking requests. Recommended size: 400x400px (JPG, PNG, WebP).
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Read-only account identifiers: username is a permanent handle, email lives on
              the auth record, not the profiles row - neither is editable from this form. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <div className="flex flex-1 items-center gap-2 text-sm text-gray-600 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <AtSign className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span>
                <strong className="text-gray-900">@{profile.username}</strong>{' '}
                <span className="text-xs text-gray-400 font-normal">(permanent account handle)</span>
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2 text-sm text-gray-600 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <Mail className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <span className="text-gray-900">{email || 'Not available'}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="displayName" className="form-label">
                  Display name <span className="text-red-500">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    clearFieldError('displayName');
                  }}
                  className={fieldErrors.displayName ? 'input-field input-field--error' : 'input-field'}
                  placeholder="Your visible name"
                  aria-invalid={fieldErrors.displayName ? true : undefined}
                  aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                />
                {fieldErrors.displayName && (
                  <p id="displayName-error" className="form-error">
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="phoneNumber" className="form-label">
                  Phone number <span className="text-red-500">*</span>
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    clearFieldError('phoneNumber');
                  }}
                  className={fieldErrors.phoneNumber ? 'input-field input-field--error' : 'input-field'}
                  placeholder="e.g. 081-234-5678"
                  aria-invalid={fieldErrors.phoneNumber ? true : undefined}
                  aria-describedby={fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined}
                />
                {fieldErrors.phoneNumber && (
                  <p id="phoneNumber-error" className="form-error">
                    {fieldErrors.phoneNumber}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="location" className="form-label">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  clearFieldError('location');
                }}
                className={fieldErrors.location ? 'input-field input-field--error' : 'input-field'}
                placeholder="e.g. Bangkok, Thailand"
                aria-invalid={fieldErrors.location ? true : undefined}
                aria-describedby={fieldErrors.location ? 'location-error' : undefined}
              />
              {fieldErrors.location && (
                <p id="location-error" className="form-error">
                  {fieldErrors.location}
                </p>
              )}
            </div>
          </div>

          {requestError && (
            <p role="alert" className="form-alert">
              {requestError}
            </p>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={updateProfileMutation.isPending}
              className="btn-secondary text-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="btn-primary text-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
