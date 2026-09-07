/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';

// Factory form avoids loading the real module, which transitively hits import.meta.env.
jest.mock('../hooks/useAuth', () => ({ useAuth: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);

function authResult(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    session: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    signOut: jest.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>;
}

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<p>Secret content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state while the session is still resolving', () => {
    mockedUseAuth.mockReturnValue(authResult({ isLoading: true }));
    renderProtectedRoute();

    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated user to /login instead of rendering the route', () => {
    mockedUseAuth.mockReturnValue(authResult({ isAuthenticated: false }));
    renderProtectedRoute();

    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders the protected route once the user is authenticated', () => {
    mockedUseAuth.mockReturnValue(authResult({ isAuthenticated: true }));
    renderProtectedRoute();

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
