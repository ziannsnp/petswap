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
      <p>Foundation route for US-D.1. Replace with the approved VibeCode privacy/terms content.</p>
      <p>Policy version: {CURRENT_CONSENT_VERSION}</p>
      <p>
        <Link to="/terms">Read the terms of service</Link>
      </p>
    </main>
  );
}
