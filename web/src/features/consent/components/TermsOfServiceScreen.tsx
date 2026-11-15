import { Link } from 'react-router-dom';
import { CURRENT_CONSENT_VERSION } from '../lib/consentPolicy';

export function TermsOfServiceScreen() {
  return (
    <main className="placeholder-screen">
      <p className="eyebrow">Don't Like My Pets</p>
      <h1>Terms of service</h1>
      <p>
        By creating an account you agree to use the marketplace lawfully, to give accurate pet and
        booking information, and to honour bookings you accept. We may suspend accounts that abuse
        the service or endanger animals.
      </p>
      <p>Policy version: {CURRENT_CONSENT_VERSION}</p>
      <p>
        <Link className="font-medium text-brand-600 hover:underline" to="/privacy">Read the privacy notice</Link>
      </p>
    </main>
  );
}
