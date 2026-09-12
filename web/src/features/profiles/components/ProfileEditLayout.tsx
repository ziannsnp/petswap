import { ArrowLeft, Camera, Mail, AtSign } from 'lucide-react';
import type { Profile } from '../lib/profileApi';

interface ProfileEditLayoutProps {
  profile: Profile;
  email?: string | null;
  onCancel: () => void;
  onSave?: () => void;
  children?: React.ReactNode;
}

export function ProfileEditLayout({
  profile,
  email,
  onCancel,
  onSave,
  children,
}: ProfileEditLayoutProps) {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile.display_name || profile.username || 'User'
  )}&background=0d9488&color=fff&size=160`;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      {/* Header with back/cancel action */}
      <div className="border-b border-gray-100 bg-gray-50/70 px-6 py-4 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-200/70 hover:text-gray-900 transition-colors cursor-pointer"
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

      <div className="p-6 sm:p-8 space-y-8">
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

        {/* If child form provided, render it; otherwise render layout placeholders */}
        {children ? (
          children
        ) : (
          <div className="space-y-6">
            {/* Account Information (Read-only Username) */}
            <div className="flex items-center gap-2 text-sm text-gray-600 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
              <AtSign className="h-4 w-4 text-gray-400" />
              <span>Username: <strong className="text-gray-900">@{profile.username}</strong> <span className="text-xs text-gray-400 font-normal">(permanent account handle)</span></span>
            </div>

            {/* Inputs Layout Preview */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    Display name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    defaultValue={profile.display_name}
                    className="input-field"
                    placeholder="Your visible name"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Email address
                  </label>
                  <input
                    type="email"
                    defaultValue={email || 'alex.rivera@example.com'}
                    className="input-field"
                    placeholder="e.g. user@example.com"
                  />
                  <p className="form-hint">Email address linked to your account</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">
                    Phone number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    defaultValue={profile.phone_number || ''}
                    className="input-field"
                    placeholder="e.g. 081-234-5678"
                  />
                </div>
                <div>
                  <label className="form-label">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    defaultValue={profile.location || ''}
                    className="input-field"
                    placeholder="e.g. Bangkok, Thailand"
                  />
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary text-center cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                className="btn-primary text-center cursor-pointer"
              >
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
