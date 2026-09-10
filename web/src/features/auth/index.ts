export { AuthScreen } from './components/AuthScreen';
export { RegisterScreen } from './components/RegisterScreen';
export { ProtectedRoute } from './components/ProtectedRoute';
export { useAuth, authKeys } from './hooks/useAuth';
export { useSignUp } from './hooks/useSignUp';
export {
  getCurrentSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  SignInError,
  SignUpError,
} from './lib/authApi';
// The credential rules FR-1.1 actually specifies. `credentialValidation.ts` is
// deliberately not re-exported: its rules contradict these (it accepts periods and
// uppercase in usernames, and a password with no uppercase or symbol), so publishing
// both would put two answers to the same question in one public interface.
export {
  USERNAME_REQUIREMENTS_MESSAGE,
  isValidUsername,
  normalizeUsername,
} from './lib/username';
export { PASSWORD_REQUIREMENTS_MESSAGE, isValidPassword } from './lib/password';
export { EMAIL_REQUIREMENTS_MESSAGE, isValidEmail, normalizeEmail } from './lib/email';
export type {
  SignInErrorCode,
  SignInInput,
  SignInResult,
  SignUpErrorCode,
  SignUpInput,
  SignUpResult,
} from './types';
