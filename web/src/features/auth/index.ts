export { AuthScreen } from './components/AuthScreen';
export { RegisterScreen } from './components/RegisterScreen';
export { ProtectedRoute } from './components/ProtectedRoute';
export { LogoutButton, type LogoutButtonProps } from './components/LogoutButton';
export { LogoutConfirmDialog, type LogoutConfirmDialogProps } from './components/LogoutConfirmDialog';
export { AuthProvider } from './components/AuthProvider';
export { AuthContext } from './context/authContext';
export type { AuthContextValue } from './context/authContext';
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
// The credential rules FR-1.1 specifies, one module per field.
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
