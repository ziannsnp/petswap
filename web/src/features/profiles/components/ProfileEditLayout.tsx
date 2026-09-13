import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, AtSign, Camera, Mail, User } from 'lucide-react';
import { getInitials } from '@/shared/lib/initials';
import { useDeleteAvatar, useUpdateProfile, useUploadAvatar } from '../hooks/useProfile';
import { validateProfileForm, type ProfileValidationErrors } from '../lib/profileValidation';
import type { Profile } from '../lib/profileApi';

interface ProfileEditLayoutProps {
  profile: Profile;
  email?: string | null;
  onCancel: () => void;
  onSave?: () => void;
}

const GENERIC_FAILURE_MESSAGE = "We couldn't save your changes. Please try again.";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
// Deliberately narrower than profileApi's own AVATAR_MIME_TYPES (which also
// accepts GIF for whatever was already uploaded before this UI existed): the
// upload UI itself only ever offers these three, per the approved spec.
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AVATAR_TOO_LARGE_MESSAGE = 'Photo must be 5MB or smaller.';
const INVALID_AVATAR_TYPE_MESSAGE = 'Choose a JPG, PNG, or WebP image.';
const AVATAR_UPLOAD_FAILURE_MESSAGE = "Couldn't upload your photo. Please try again.";

export function ProfileEditLayout({ profile, email, onCancel, onSave }: ProfileEditLayoutProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [fieldErrors, setFieldErrors] = useState<ProfileValidationErrors>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const updateProfileMutation = useUpdateProfile();
  const uploadAvatarMutation = useUploadAvatar();
  const deleteAvatarMutation = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revokes the previous blob URL whenever it's replaced, and on unmount.
  useEffect(() => {
    if (!avatarPreviewUrl) {
      return;
    }
    return () => {
      URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  // Initials fallback matches the Navbar's account avatar and ProfileViewCard,
  // rather than each place calling out to ui-avatars.com with its own rules.
  const initials = getInitials(profile.display_name || profile.username);
  const avatarSrc = avatarPreviewUrl ?? (removePhoto ? null : profile.photo_url);
  const showPhoto = Boolean(avatarSrc) && !photoFailed;
  const canRemovePhoto = !removePhoto && Boolean(avatarFile || profile.photo_url);

  useEffect(() => {
    setPhotoFailed(false);
  }, [avatarSrc]);
  const isSaving =
    uploadAvatarMutation.isPending || deleteAvatarMutation.isPending || updateProfileMutation.isPending;

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

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset now so choosing the same file again still fires this handler.
    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setPhotoError(AVATAR_TOO_LARGE_MESSAGE);
      return;
    }

    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setPhotoError(INVALID_AVATAR_TYPE_MESSAGE);
      return;
    }

    setPhotoError(null);
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function handleRemovePhoto() {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setRemovePhoto(true);
    setPhotoError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = validateProfileForm({ displayName, phoneNumber, location });

    if (!result.isValid) {
      setFieldErrors(result.errors);
      return;
    }

    setFieldErrors({});
    setPhotoError(null);

    let photoUrl = profile.photo_url;

    if (avatarFile) {
      try {
        photoUrl = await uploadAvatarMutation.mutateAsync(avatarFile);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : AVATAR_UPLOAD_FAILURE_MESSAGE);
        return;
      }
    } else if (removePhoto) {
      if (profile.photo_url) {
        try {
          await deleteAvatarMutation.mutateAsync();
        } catch (err) {
          // Storage cleanup failing shouldn't block clearing photo_url on the
          // profile row - the object is orphaned either way if this fails,
          // but the user's own "remove photo" intent still needs to save.
          console.error('Failed to remove the avatar from storage:', err);
        }
      }
      photoUrl = null;
    }

    try {
      await updateProfileMutation.mutateAsync({
        display_name: result.sanitizedValues.displayName,
        phone_number: result.sanitizedValues.phoneNumber,
        location: result.sanitizedValues.location,
        photo_url: photoUrl,
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
              disabled={isSaving}
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
            {showPhoto ? (
              <img
                src={avatarSrc as string}
                alt={profile.display_name}
                className="h-28 w-28 rounded-full border-2 border-gray-200 bg-gray-50 object-cover shadow-xs cursor-pointer"
                onClick={() => !isSaving && fileInputRef.current?.click()}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-gray-200 bg-brand-600 text-4xl font-semibold text-white shadow-xs cursor-pointer"
                role="img"
                aria-label={profile.display_name}
                onClick={() => !isSaving && fileInputRef.current?.click()}
              >
                {initials || <User className="h-10 w-10" aria-hidden="true" />}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-2 text-white shadow-md hover:bg-brand-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Change profile photo"
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              disabled={isSaving}
              className="hidden"
              aria-label="Upload profile photo"
            />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-base font-semibold text-gray-900">Profile Photo</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Your photo appears on your profile and booking requests. JPG, PNG, or WebP, up to 5MB.
            </p>
            {canRemovePhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isSaving}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
            {photoError && (
              <p role="alert" className="form-error mt-2">
                {photoError}
              </p>
            )}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                disabled={isSaving}
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
              disabled={isSaving}
              className="btn-secondary text-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary text-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
