import { useContext } from 'react';
import { AuthContext, authKeys, type AuthContextValue } from '../context/authContext';

export { authKeys, type AuthContextValue };

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
