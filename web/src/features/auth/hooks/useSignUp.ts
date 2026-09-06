import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signUp } from '../lib/authApi';
import { authKeys } from './useAuth';

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signUp,
    onSuccess: ({ session }) => {
      queryClient.setQueryData(authKeys.session(), session);
    },
  });
}
