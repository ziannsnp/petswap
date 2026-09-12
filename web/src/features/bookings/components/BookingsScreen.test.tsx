/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { BookingsScreen } from './BookingsScreen';
import { useIncomingBookings, useOutgoingBookings, useUpdateBookingStatus } from '../hooks/useBookings';
import type { BookingWithDetails } from '../lib/bookingApi';

// Explicit factory so the real hooks module (and its supabase/import.meta.env chain) never loads under Jest.
jest.mock('../hooks/useBookings', () => ({
  useOutgoingBookings: jest.fn(),
  useIncomingBookings: jest.fn(),
  useUpdateBookingStatus: jest.fn(),
}));

const mockUseOutgoingBookings = useOutgoingBookings as jest.Mock;
const mockUseIncomingBookings = useIncomingBookings as jest.Mock;
const mockUseUpdateBookingStatus = useUpdateBookingStatus as jest.Mock;

type BookingQueryResult = UseQueryResult<BookingWithDetails[], Error>;

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

// Matches the literal characters BookingsScreen renders via the &middot; / &ndash; JSX entities.
const MIDDOT = String.fromCharCode(0xb7);
const EN_DASH = String.fromCharCode(0x2013);

function makeBooking(overrides: Partial<BookingWithDetails> = {}): BookingWithDetails {
  return {
    id: 'booking-1',
    listing_id: 'listing-1',
    pet_id: 'pet-1',
    requester_id: 'requester-1',
    status: 'confirmed',
    start_date: '2026-09-10',
    end_date: '2026-09-14',
    requester_note: null,
    owner_note: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    confirmed_at: null,
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: { id: 'pet-1', name: 'Milo', species: 'dog', photo_url: null },
    listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' },
    ...overrides,
  };
}

function successResult(data: BookingWithDetails[]): BookingQueryResult {
  return {
    data,
    error: null,
    isPending: false,
    isLoading: false,
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  } as unknown as BookingQueryResult;
}

function loadingResult(): BookingQueryResult {
  return {
    data: undefined,
    error: null,
    isPending: true,
    isLoading: true,
    isSuccess: false,
    isError: false,
    isFetching: true,
    refetch: jest.fn(),
  } as unknown as BookingQueryResult;
}

function errorResult(message: string, refetch: jest.Mock = jest.fn()): BookingQueryResult {
  return {
    data: undefined,
    error: new Error(message),
    isPending: false,
    isLoading: false,
    isSuccess: false,
    isError: true,
    isFetching: false,
    refetch,
  } as unknown as BookingQueryResult;
}

beforeEach(() => {
  mockUseUpdateBookingStatus.mockReturnValue({ mutateAsync: jest.fn().mockResolvedValue({}) });
});

afterEach(() => {
  jest.clearAllMocks();
});

it('renders outgoing and incoming items with their pet and listing details', () => {
  const outgoingBooking = makeBooking({
    id: 'out-1',
    status: 'confirmed',
    pet: { id: 'pet-1', name: 'Milo', species: 'dog', photo_url: null },
    listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' },
  });
  const incomingBooking = makeBooking({
    id: 'in-1',
    status: 'pending',
    start_date: '2026-10-01',
    end_date: '2026-10-05',
    pet: { id: 'pet-2', name: 'Bella', species: 'cat', photo_url: null },
    listing: { id: 'listing-2', title: 'Sunny Deck', location: 'Denver' },
  });
  mockUseOutgoingBookings.mockReturnValue(successResult([outgoingBooking]));
  mockUseIncomingBookings.mockReturnValue(successResult([incomingBooking]));

  render(<BookingsScreen />);

  expect(screen.getByText('Milo', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('(Dog)')).toBeInTheDocument();
  expect(screen.getByText(`Cozy Yard ${MIDDOT} Austin`)).toBeInTheDocument();
  expect(
    screen.getByText(`${formatBookingDate('2026-09-10')} ${EN_DASH} ${formatBookingDate('2026-09-14')}`),
  ).toBeInTheDocument();
  expect(screen.getByText('Confirmed')).toBeInTheDocument();

  expect(screen.getByText('Bella', { exact: false })).toBeInTheDocument();
  expect(screen.getByText('(Cat)')).toBeInTheDocument();
  expect(screen.getByText(`Sunny Deck ${MIDDOT} Denver`)).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
});

it('shows a loading indicator while a section is pending', () => {
  mockUseOutgoingBookings.mockReturnValue(loadingResult());
  mockUseIncomingBookings.mockReturnValue(successResult([]));

  render(<BookingsScreen />);

  expect(screen.getByText(/loading outgoing requests/i)).toBeInTheDocument();
});

it('shows an error banner with a retry button that calls refetch', () => {
  const refetch = jest.fn();
  mockUseOutgoingBookings.mockReturnValue(errorResult('Network error', refetch));
  mockUseIncomingBookings.mockReturnValue(successResult([]));

  render(<BookingsScreen />);

  expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(refetch).toHaveBeenCalledTimes(1);
});

it('shows distinct empty messages when only one side has bookings', () => {
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([makeBooking()]));

  render(<BookingsScreen />);

  expect(screen.getByText("You haven't sent any requests yet")).toBeInTheDocument();
  expect(screen.queryByText('No bookings yet.', { exact: false })).not.toBeInTheDocument();
});

it('shows the incoming empty message when only outgoing has bookings', () => {
  mockUseOutgoingBookings.mockReturnValue(successResult([makeBooking()]));
  mockUseIncomingBookings.mockReturnValue(successResult([]));

  render(<BookingsScreen />);

  expect(screen.getByText('No incoming requests on your listings')).toBeInTheDocument();
});

it('shows a single combined empty state when both lists are completely empty', () => {
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([]));

  render(<BookingsScreen />);

  expect(screen.getByText('No bookings yet.')).toBeInTheDocument();
  expect(screen.queryByText("You haven't sent any requests yet")).not.toBeInTheDocument();
  expect(screen.queryByText('No incoming requests on your listings')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Outgoing requests' })).not.toBeInTheDocument();
});

it('offers Confirm/Decline only on pending incoming requests, never on outgoing ones', () => {
  const pendingIncoming = makeBooking({ id: 'in-pending', status: 'pending' });
  const confirmedOutgoing = makeBooking({ id: 'out-confirmed', status: 'confirmed' });
  mockUseOutgoingBookings.mockReturnValue(successResult([confirmedOutgoing]));
  mockUseIncomingBookings.mockReturnValue(successResult([pendingIncoming]));

  render(<BookingsScreen />);

  expect(screen.getAllByRole('button', { name: 'Confirm' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Decline' })).toHaveLength(1);
});

it('does not offer actions on an incoming booking that is already confirmed', () => {
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([makeBooking({ status: 'confirmed' })]));

  render(<BookingsScreen />);

  expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
});

it('confirms a pending incoming booking', async () => {
  const mutateAsync = jest.fn().mockResolvedValue({});
  mockUseUpdateBookingStatus.mockReturnValue({ mutateAsync });
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([makeBooking({ id: 'in-1', status: 'pending' })]));

  render(<BookingsScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'in-1', status: 'confirmed' }));
});

it('declines a pending incoming booking', async () => {
  const mutateAsync = jest.fn().mockResolvedValue({});
  mockUseUpdateBookingStatus.mockReturnValue({ mutateAsync });
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([makeBooking({ id: 'in-1', status: 'pending' })]));

  render(<BookingsScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'in-1', status: 'declined' }));
});

it('shows an error on the affected card when a status update fails', async () => {
  const mutateAsync = jest.fn().mockRejectedValue(new Error('network down'));
  mockUseUpdateBookingStatus.mockReturnValue({ mutateAsync });
  mockUseOutgoingBookings.mockReturnValue(successResult([]));
  mockUseIncomingBookings.mockReturnValue(successResult([makeBooking({ id: 'in-1', status: 'pending' })]));

  render(<BookingsScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/could not update this booking/i);
});
