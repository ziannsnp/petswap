/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PET_TYPE_OPTIONS } from '../lib/listingOptions';
import { validListingFormValues } from '../testing/listingFixtures';
import { CreateListingScreen } from './CreateListingScreen';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <CreateListingScreen />
    </MemoryRouter>,
  );
}

async function completeRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/listing title/i), validListingFormValues.title);
  await user.type(screen.getByLabelText(/location/i), validListingFormValues.location);
  await user.type(screen.getByLabelText(/description/i), validListingFormValues.description);
  await user.clear(screen.getByLabelText(/capacity/i));
  await user.type(screen.getByLabelText(/capacity/i), String(validListingFormValues.capacity));
}

describe('CreateListingScreen', () => {
  beforeAll(() => {
    URL.createObjectURL = jest.fn(() => 'blob:listing-photo');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('offers every supported pet species and starts with Dog selected', () => {
    renderScreen();

    for (const { label } of PET_TYPE_OPTIONS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Dog' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows required-field errors and does not enter the saving state for invalid input', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.clear(screen.getByLabelText(/capacity/i));
    await user.click(screen.getByRole('button', { name: /save listing/i }));

    expect(screen.getByText('Listing title is required.')).toBeInTheDocument();
    expect(screen.getByText('Location is required.')).toBeInTheDocument();
    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(screen.getByText('Capacity must be at least 1.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save listing/i })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('selects and deselects a facility', async () => {
    const user = userEvent.setup();
    renderScreen();
    const fencedYard = screen.getByRole('checkbox', { name: 'Fenced yard' });

    await user.click(fencedYard);
    expect(fencedYard).toBeChecked();

    await user.click(fencedYard);
    expect(fencedYard).not.toBeChecked();
  });

  it('previews and removes a selected photo while revoking its object URL', async () => {
    const user = userEvent.setup();
    renderScreen();
    const photo = new File(['photo'], 'garden.jpg', { type: 'image/jpeg' });

    await user.upload(screen.getByLabelText(/add listing photos/i), photo);
    expect(screen.getByRole('img', { name: 'garden.jpg' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove garden.jpg' }));
    expect(screen.queryByRole('img', { name: 'garden.jpg' })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:listing-photo');
  });

  it('disables actions while a valid UI-only submission is pending and then reports success', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderScreen();
    await completeRequiredFields(user);

    await user.click(screen.getByRole('button', { name: /save listing/i }));
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(700);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Listing details checked successfully.');
  });

  it.todo('preserves the form and shows an alert when C\'s photo upload mutation fails');
});
