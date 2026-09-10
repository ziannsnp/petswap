export { AuthScreen } from './components/AuthScreen';
export { RegisterForm } from './components/RegisterForm';
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
export {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  USERNAME_REQUIREMENTS_MESSAGE,
  PASSWORD_REQUIREMENTS_MESSAGE,
  normalizeUsername,
  validateUsername,
  isValidUsername,
  validatePassword,
  isValidPassword,
  validatePasswordConfirmation,
  validateEmail,
  isValidEmail,
  validateDisplayName,
  validateRegistration,
  validateLogin,
} from './lib/credentialValidation';
export type {
  RegistrationValidationFields,
  RegistrationValidationErrors,
  LoginValidationFields,
  LoginValidationErrors,
} from './lib/credentialValidation';
export type {
  SignInErrorCode,
  SignInInput,
  SignInResult,
  SignUpErrorCode,
  SignUpInput,
  SignUpResult,
} from './types';
