import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { discardConfirmationSession } from '../lib/authApi';
import { readConfirmationOutcome, type ConfirmationOutcome } from '../lib/confirmationLink';

// Reads how the visitor reached the login page. The outcome is fixed on first render:
// the router's location still holds the fragment Supabase redirected with, even after
// the Supabase client has scrubbed it from the address bar.
export function useConfirmationLanding(): ConfirmationOutcome | null {
  const location = useLocation();
  const [outcome] = useState(() => readConfirmationOutcome(location.search, location.hash));

  useEffect(() => {
    if (outcome !== 'confirmed') {
      return;
    }

    // A failure here leaves the visitor signed in, which is harmless: the account is
    // confirmed and the success message is still true.
    discardConfirmationSession().catch(() => undefined);
  }, [outcome]);

  return outcome;
}
