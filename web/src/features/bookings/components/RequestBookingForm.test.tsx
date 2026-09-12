/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RequestBookingForm } from './RequestBookingForm';
import { useAuth } from '@/features/auth';
import { useMyPets } from '@/features/pets';
import { useCreateBookingRequest } from '../hooks/useBookings';

// Explicit factories so the real hook modules (and their supabase/import.meta.env
// chains) never load under Jest.
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/pets', () => ({ useMyPets: jest.fn() }));
jest.mock('../hooks/useBookings', () => ({ useCreateBookingRequest: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const mockUseMyPets = useMyPets as jest.Mock;
const mockUseCreateBookingRequest = useCreateBookingRequest as jest.Mock;

const OWNER_ID = 'owner-1';
const REQUESTER_ID = 'requester-1';

function authenticatedAs(userId: string) {
  mockUseAuth.mockReturnValue({
    user: { id: userId },
    isAuthenticated: true,
    isLoading: false,
    session: null,
    error: null,
    signOut: jest.fn(),
  });
}

function petsResult(data: Array<{ id: string; name: string; species: string }> | undefined, overrides = {}) {
  return { data, isLoading: false, isSuccess: data !== undefined, isError: false, ...overrides };
}

function renderForm(overrides: Partial<{ listingId: string; listingOwnerId: string; acceptedPetTypes: string[] }> = {}) {
  return render(
    <MemoryRouter>
      <RequestBookingForm
        listingId={overrides.listingId ?? 'listing-1'}
        listingOwnerId={overrides.listingOwnerId ?? OWNER_ID}
        acceptedPetTypes={overrides.acceptedPetTypes ?? ['dog', 'cat']}
      />
    </MemoryRouter>,
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

it('prompts a signed-out visitor to log in instead of showing the form', () => {
  mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false, session: null, error: null, signOut: jest.fn() });
  mockUseMyPets.mockReturnValue(petsResult([]));
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync: jest.fn(), isPending: false, isError: false, reset: jest.fn() });

  renderForm();

  expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /request booking/i })).not.toBeInTheDocument();
});

it('renders nothing for the listing owner', () => {
  authenticatedAs(OWNER_ID);
  mockUseMyPets.mockReturnValue(petsResult([]));
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync: jest.fn(), isPending: false, isError: false, reset: jest.fn() });

  const { container } = renderForm();

  expect(container).toBeEmptyDOMElement();
});

it('tells a requester with no matching pet to add one first', () => {
  authenticatedAs(REQUESTER_ID);
  mockUseMyPets.mockReturnValue(petsResult([{ id: 'pet-1', name: 'Pixel', species: 'rabbit' }]));
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync: jest.fn(), isPending: false, isError: false, reset: jest.fn() });

  renderForm({ acceptedPetTypes: ['dog', 'cat'] });

  expect(screen.getByText(/none of your pets match/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /request booking/i })).not.toBeInTheDocument();
});

it('validates the form before submitting', () => {
  authenticatedAs(REQUESTER_ID);
  mockUseMyPets.mockReturnValue(petsResult([{ id: 'pet-1', name: 'Rocket', species: 'dog' }]));
  const mutateAsync = jest.fn();
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync, isPending: false, isError: false, reset: jest.fn() });

  renderForm();
  fireEvent.click(screen.getByRole('button', { name: /request booking/i }));

  expect(screen.getByText('Choose which pet this booking is for.')).toBeInTheDocument();
  expect(screen.getByText('Start date is required.')).toBeInTheDocument();
  expect(screen.getByText('End date is required.')).toBeInTheDocument();
  expect(mutateAsync).not.toHaveBeenCalled();
});

it('submits a valid request and shows a confirmation', async () => {
  authenticatedAs(REQUESTER_ID);
  mockUseMyPets.mockReturnValue(petsResult([{ id: 'pet-1', name: 'Rocket', species: 'dog' }]));
  const mutateAsync = jest.fn().mockResolvedValue({});
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync, isPending: false, isError: false, reset: jest.fn() });

  renderForm({ listingId: 'listing-9' });

  fireEvent.change(screen.getByLabelText('Pet'), { target: { value: 'pet-1' } });
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-01-10' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-14' } });
  fireEvent.click(screen.getByRole('button', { name: /request booking/i }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
    listing_id: 'listing-9',
    pet_id: 'pet-1',
    requester_id: REQUESTER_ID,
    start_date: '2027-01-10',
    end_date: '2027-01-14',
  }));
  expect(await screen.findByText(/your booking request has been sent/i)).toBeInTheDocument();
});

it('shows an error banner when the request fails', async () => {
  authenticatedAs(REQUESTER_ID);
  mockUseMyPets.mockReturnValue(petsResult([{ id: 'pet-1', name: 'Rocket', species: 'dog' }]));
  const mutateAsync = jest.fn().mockRejectedValue(new Error('network down'));
  mockUseCreateBookingRequest.mockReturnValue({ mutateAsync, isPending: false, isError: true, reset: jest.fn() });

  renderForm();

  fireEvent.change(screen.getByLabelText('Pet'), { target: { value: 'pet-1' } });
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-01-10' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2027-01-14' } });
  fireEvent.click(screen.getByRole('button', { name: /request booking/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not send your booking request/i);
});
