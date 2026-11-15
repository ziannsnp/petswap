import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signUp } from '../lib/authApi';
import { setSessionCache } from '../lib/sessionCache';

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signUp,
    onSuccess: ({ session }) => {
      setSessionCache(queryClient, session);
    },
  });
}
