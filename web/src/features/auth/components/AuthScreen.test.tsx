/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  // FR-1.1 accepts either credential, so the field must not be labelled or typed as
  // an email address alone — a username has to be enterable here too.
  it('offers one field that accepts an email address or a username', () => {
    renderScreen();

    const identifier = screen.getByLabelText(/email or username/i);

    expect(identifier).toBeInTheDocument();
    expect(identifier).toHaveAttribute('type', 'text');
  });

  it('offers a password field and a submit button', () => {
    renderScreen();

    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute('type', 'submit');
  });

  it('keeps what the visitor types in both fields', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.type(screen.getByLabelText(/email or username/i), 'someone@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Sup3rSecret!');

    expect(screen.getByLabelText(/email or username/i)).toHaveValue('someone@example.com');
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('Sup3rSecret!');
  });

  // Revealing the password is a deliberate escape hatch from typing blind; the toggle
  // has to change the input's type, not merely its own label.
  it('reveals and re-hides the password on request', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
  });

  // ProtectedRoute sends unauthenticated users here, so this link is still the only
  // route to registration from inside the app.
  it('offers a way to reach registration', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
