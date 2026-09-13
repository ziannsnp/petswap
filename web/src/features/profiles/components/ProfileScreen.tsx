import { useState } from 'react';
import { useAuth } from '@/features/auth';
import { useCurrentProfile } from '../hooks/useProfile';
import { ProfileViewCard } from './ProfileViewCard';
import { ProfileEditLayout } from './ProfileEditLayout';

function ProfileSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs animate-pulse" aria-hidden="true">
      <div className="px-6 pb-8 pt-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div className="h-28 w-28 rounded-full border-4 border-white bg-gray-200 sm:h-32 sm:w-32" />
          <div className="h-10 w-28 rounded-lg bg-gray-200" />
        </div>
        <div className="mb-6 space-y-2">
          <div className="h-7 w-48 rounded bg-gray-200" />
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 sm:p-6 space-y-4">
          <div className="h-3 w-36 rounded bg-gray-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-16 rounded-lg bg-gray-200" />
            <div className="h-16 rounded-lg bg-gray-200" />
            <div className="h-16 rounded-lg bg-gray-200" />
            <div className="h-16 rounded-lg bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen() {
  const { user } = useAuth();
  const { data: profile, isLoading, isError, refetch } = useCurrentProfile();
  const [isEditing, setIsEditing] = useState(false);

  const displayEmail = user?.email ?? '';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4" role="status" aria-busy="true">
            <span className="sr-only">Loading your profile...</span>
            <ProfileSkeleton />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700"
            role="alert"
          >
            <h2 className="font-semibold text-lg mb-1">Failed to load profile</h2>
            <p className="text-sm text-red-600 mb-4">
              We encountered an issue fetching your profile details.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Missing Profile State: authenticated, but no profiles row exists */}
        {!isLoading && !isError && !profile && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800"
            role="alert"
          >
            <h2 className="font-semibold text-lg mb-1">Profile not found</h2>
            <p className="text-sm text-amber-700 mb-4">
              We couldn't find your profile record. Please try again, or contact support if this keeps happening.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Profile Content: View Mode or Edit Mode */}
        {!isLoading && !isError && profile && (
          <>
            {!isEditing ? (
              <ProfileViewCard
                profile={profile}
                email={displayEmail}
                onEdit={() => setIsEditing(true)}
              />
            ) : (
              <ProfileEditLayout
                profile={profile}
                email={displayEmail}
                onCancel={() => setIsEditing(false)}
                onSave={() => setIsEditing(false)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
