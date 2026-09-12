import { AtSign, Edit2, Mail, MapPin, Phone, User } from 'lucide-react';
import type { Profile } from '../lib/profileApi';

interface ProfileViewCardProps {
  profile: Profile;
  email?: string | null;
  onEdit: () => void;
}

export function ProfileViewCard({ profile, email, onEdit }: ProfileViewCardProps) {
  const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile.display_name || profile.username || 'User'
  )}&background=0d9488&color=fff&size=160`;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      {/* Top Banner Accent */}
      <div className="h-28 bg-gradient-to-r from-brand-600 via-brand-500 to-teal-400 sm:h-36" />

      <div className="relative px-6 pb-8 pt-0 sm:px-8">
        {/* Avatar & Header Action */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 mb-6">
          <div className="relative inline-block">
            <img
              src={profile.photo_url || avatarFallback}
              alt={profile.display_name}
              className="h-28 w-28 rounded-full border-4 border-white bg-white object-cover shadow-md sm:h-32 sm:w-32"
              onError={(e) => {
                // Fallback to generated avatar if image URL fails to load
                (e.currentTarget as HTMLImageElement).src = avatarFallback;
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors cursor-pointer"
              aria-label="Edit your profile"
            >
              <Edit2 className="h-4 w-4" aria-hidden="true" />
              <span>Edit profile</span>
            </button>
          </div>
        </div>

        {/* User Identity Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{profile.display_name}</h1>
          <p className="text-sm font-medium text-brand-700 mt-0.5">@{profile.username}</p>
        </div>

        {/* Information Grid */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 sm:p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
            Account & Contact Details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {/* Display Name */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200/70 bg-white p-3.5 shadow-2xs">
              <div className="rounded-md bg-brand-50 p-2 text-brand-700">
                <User className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-500">Display name</span>
                <span className="block text-sm font-semibold text-gray-900 truncate">
                  {profile.display_name}
                </span>
              </div>
            </div>

            {/* Username */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200/70 bg-white p-3.5 shadow-2xs">
              <div className="rounded-md bg-brand-50 p-2 text-brand-700">
                <AtSign className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-500">Username</span>
                <span className="block text-sm font-semibold text-gray-900 truncate">
                  @{profile.username}
                </span>
              </div>
            </div>

            {/* Email Address */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200/70 bg-white p-3.5 shadow-2xs">
              <div className="rounded-md bg-brand-50 p-2 text-brand-700">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-500">Email address</span>
                <span className="block text-sm font-semibold text-gray-900 truncate">
                  {email || 'Not available'}
                </span>
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200/70 bg-white p-3.5 shadow-2xs">
              <div className="rounded-md bg-brand-50 p-2 text-brand-700">
                <Phone className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-500">Phone number</span>
                {profile.phone_number ? (
                  <span className="block text-sm font-semibold text-gray-900">
                    {profile.phone_number}
                  </span>
                ) : (
                  <span className="block text-sm italic text-gray-400">Not provided yet</span>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-200/70 bg-white p-3.5 shadow-2xs sm:col-span-2">
              <div className="rounded-md bg-brand-50 p-2 text-brand-700">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-500">Location</span>
                {profile.location ? (
                  <span className="block text-sm font-semibold text-gray-900">
                    {profile.location}
                  </span>
                ) : (
                  <span className="block text-sm italic text-gray-400">Not provided yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
