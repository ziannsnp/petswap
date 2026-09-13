import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentProfile, updateProfile, type ProfileUpdate } from '../lib/profileApi';

export const profileKeys = {
  all: ['profiles'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};

export function useCurrentProfile() {
  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: getCurrentProfile,
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
