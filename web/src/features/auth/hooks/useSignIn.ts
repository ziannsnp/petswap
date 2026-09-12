import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signIn } from '../lib/authApi';
import { authKeys } from './useAuth';

// Sibling of useSignUp: the adapter returns the fresh session, so seed it into the
// auth cache directly rather than invalidating and making AuthProvider re-fetch a
// session we are already holding.
export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signIn,
    onSuccess: ({ session }) => {
      queryClient.setQueryData(authKeys.session(), session);
    },
  });
}
