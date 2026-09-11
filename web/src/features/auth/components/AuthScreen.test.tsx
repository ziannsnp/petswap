/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthScreen } from './AuthScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <AuthScreen />
    </MemoryRouter>,
  );
}

describe('AuthScreen', () => {
  it('names the product so a signed-out visitor knows where they are', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: /don't like my pets/i })).toBeInTheDocument();
  });

  // ProtectedRoute sends unauthenticated users here, so this link is currently the
  // only route to registration inside the app.
  it('offers a way to reach registration', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('says that signing in is not available yet', () => {
    renderScreen();

    expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
  });
});
