import { useMutation } from '@tanstack/react-query';
import { resendConfirmationEmail } from '../lib/authApi';

export function useResendConfirmation() {
  return useMutation({
    mutationFn: (email: string) => resendConfirmationEmail(email),
  });
}

