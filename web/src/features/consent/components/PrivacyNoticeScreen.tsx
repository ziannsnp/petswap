import { Link } from 'react-router-dom';
import { CURRENT_CONSENT_VERSION } from '../lib/consentPolicy';

export function PrivacyNoticeScreen() {
  return (
    <main className="placeholder-screen">
      <p className="eyebrow">Don't Like My Pets</p>
      <h1>Privacy notice</h1>
      <p>
        We collect your display name, contact details, pet information, and booking activity to
        operate the marketplace. We do not sell personal data or use it for advertising.
      </p>
      <p>Policy version: {CURRENT_CONSENT_VERSION}</p>
      <p>
        <Link className="font-medium text-brand-600 hover:underline" to="/terms">Read the terms of service</Link>
      </p>
    </main>
  );
}
