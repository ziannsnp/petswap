export { AuthScreen } from './components/AuthScreen';
export { ProtectedRoute } from './components/ProtectedRoute';
export { useAuth, authKeys } from './hooks/useAuth';
export { useSignUp } from './hooks/useSignUp';
export { getCurrentSession, getCurrentUser, signOut, signUp, SignUpError } from './lib/authApi';
export type { SignUpErrorCode, SignUpInput, SignUpResult } from './types';
