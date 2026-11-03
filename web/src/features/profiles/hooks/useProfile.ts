import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAvatar, getCurrentProfile, updateProfile, uploadAvatar, type ProfileUpdate } from '../lib/profileApi';

export const profileKeys = {
  all: ['profiles'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};

export function useCurrentProfile(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: getCurrentProfile,
    enabled: options.enabled ?? true,
  });
}

// updateProfile returns the saved row, so seed the cache directly rather than
// invalidating and making the next render re-fetch a profile we already hold.
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProfileUpdate) => updateProfile(values),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.current(), profile);
    },
  });
}

// Returns the new avatar's public URL; the caller persists it via
// useUpdateProfile so both fields save in a single profile update.
export function useUploadAvatar() {
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
  });
}

export function useDeleteAvatar() {
  return useMutation({
    mutationFn: () => deleteAvatar(),
  });
}
