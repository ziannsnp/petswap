/** @jest-environment jsdom */
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBookingRequest,
  getBookingDetail,
  listIncomingBookings,
  listOutgoingBookings,
  updateBookingStatus,
  type BookingDetail,
  type BookingWithDetails,
} from '../lib/bookingApi';
import { BookingListingFullError, BookingNotFoundError, BookingPetUnavailableError } from '../lib/bookingErrors';
import {
  bookingKeys,
  useBookingDetail,
  useCreateBookingRequest,
  useIncomingBookings,
  useOutgoingBookings,
  useUpdateBookingStatus,
} from './useBookings';

jest.mock('@/features/listings', () => ({
  listingKeys: { publishedPages: () => ['listings', 'published', 'page'] },
}));
jest.mock('../lib/bookingApi', () => ({
  createBookingRequest: jest.fn(),
  getBookingDetail: jest.fn(),
  listIncomingBookings: jest.fn(),
  listOutgoingBookings: jest.fn(),
  updateBookingStatus: jest.fn(),
}));

const SEARCH_PAGES = ['listings', 'published', 'page'] as const;
const BOOKING_ID = 'booking-1';

function makeRow(id: string, status: BookingWithDetails['status']): BookingWithDetails {
  return {
    id,
    listing_id: 'listing-1',
    pet_id: 'pet-1',
    requester_id: 'requester-1',
    status,
    start_date: '2099-09-10',
    end_date: '2099-09-14',
    requester_note: null,
    owner_note: null,
    created_at: '2099-01-01T00:00:00.000Z',
    updated_at: '2099-01-01T00:00:00.000Z',
    confirmed_at: null,
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: null,
    listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' },
  };
}

function makeDetail(status: BookingDetail['status']): BookingDetail {
  return {
    id: BOOKING_ID,
    status,
    startDate: '2099-09-10',
    endDate: '2099-09-14',
    requesterNote: null,
    ownerNote: null,
    createdAt: '2099-01-01T00:00:00.000Z',
    confirmedAt: null,
    declinedAt: null,
    cancelledAt: null,
    completedAt: null,
    viewerRole: 'owner',
    listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin', status: 'published' },
    pet: null,
    peer: { id: 'requester-1', displayName: 'Casey Ito', photoUrl: null, location: null },
  };
}

// A booking whose status the "server" changes underneath the screens, the way another session would.
let serverStatus: BookingDetail['status'];

function serveFromApi() {
  jest.mocked(listOutgoingBookings).mockImplementation(async () => [makeRow(BOOKING_ID, serverStatus)]);
  jest.mocked(listIncomingBookings).mockImplementation(async () => [makeRow(BOOKING_ID, serverStatus)]);
  jest.mocked(getBookingDetail).mockImplementation(async () => makeDetail(serverStatus));
}

// The user has both lists and the booking detail on screen at once.
function renderEveryBookingScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => ({
      outgoing: useOutgoingBookings(),
      incoming: useIncomingBookings(),
      detail: useBookingDetail(BOOKING_ID),
      create: useCreateBookingRequest(),
      update: useUpdateBookingStatus(),
    }),
    { wrapper },
  );
  return { queryClient, ...hook };
}

beforeEach(() => {
  jest.resetAllMocks();
  serverStatus = 'pending';
  serveFromApi();
});

describe('booking query keys', () => {
  it('start with "bookings", so one prefix refreshes every booking query and sign-in purges them all', () => {
    expect(bookingKeys.outgoing()[0]).toBe('bookings');
    expect(bookingKeys.incoming()[0]).toBe('bookings');
    expect(bookingKeys.detail(BOOKING_ID)).toEqual(['bookings', 'detail', BOOKING_ID]);
  });

  it('give each booking its own detail entry', () => {
    expect(bookingKeys.detail('a')).not.toEqual(bookingKeys.detail('b'));
  });
});

describe('after a booking request is sent', () => {
  it('refetches both lists and the open detail', async () => {
    const { result } = renderEveryBookingScreen();
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    expect(listOutgoingBookings).toHaveBeenCalledTimes(1);
    jest.mocked(createBookingRequest).mockResolvedValue(makeRow('booking-2', 'pending'));

    await act(async () => {
      await result.current.create.mutateAsync({
        listing_id: 'listing-1',
        pet_id: 'pet-1',
        requester_id: 'requester-1',
        start_date: '2099-10-01',
        end_date: '2099-10-04',
      });
    });

    await waitFor(() => expect(listOutgoingBookings).toHaveBeenCalledTimes(2));
    expect(listIncomingBookings).toHaveBeenCalledTimes(2);
    expect(getBookingDetail).toHaveBeenCalledTimes(2);
  });
});

describe('after a status change', () => {
  it('refetches the lists and the detail so each shows the new status', async () => {
    const { result } = renderEveryBookingScreen();
    await waitFor(() => expect(result.current.detail.data?.status).toBe('pending'));
    jest.mocked(updateBookingStatus).mockImplementation(async () => {
      serverStatus = 'confirmed';
      return makeRow(BOOKING_ID, 'confirmed');
    });

    await act(async () => {
      await result.current.update.mutateAsync({ bookingId: BOOKING_ID, status: 'confirmed' });
    });

    await waitFor(() => expect(result.current.detail.data?.status).toBe('confirmed'));
    await waitFor(() => expect(result.current.outgoing.data?.[0]?.status).toBe('confirmed'));
    expect(result.current.incoming.data?.[0]?.status).toBe('confirmed');
  });

  it('marks every cached search stale, because confirming or releasing a stay changes availability', async () => {
    const { result, queryClient } = renderEveryBookingScreen();
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    queryClient.setQueryData([...SEARCH_PAGES, { location: 'Austin' }], { rows: [] });
    jest.mocked(updateBookingStatus).mockResolvedValue(makeRow(BOOKING_ID, 'confirmed'));

    await act(async () => {
      await result.current.update.mutateAsync({ bookingId: BOOKING_ID, status: 'confirmed' });
    });

    expect(queryClient.getQueryState([...SEARCH_PAGES, { location: 'Austin' }])?.isInvalidated).toBe(true);
  });

  it.each([
    ['the listing filled up', new BookingListingFullError()],
    ['the pet was booked elsewhere', new BookingPetUnavailableError()],
  ])('still refetches everything when the database refuses because %s', async (_reason, refusal) => {
    const { result, queryClient } = renderEveryBookingScreen();
    await waitFor(() => expect(result.current.detail.data?.status).toBe('pending'));
    queryClient.setQueryData([...SEARCH_PAGES, { location: 'Austin' }], { rows: [] });
    // While the host looked at the request, the requester cancelled it in another session.
    jest.mocked(updateBookingStatus).mockImplementation(async () => {
      serverStatus = 'cancelled';
      throw refusal;
    });

    await act(async () => {
      await expect(result.current.update.mutateAsync({ bookingId: BOOKING_ID, status: 'confirmed' })).rejects.toBe(refusal);
    });

    // The lists and the detail no longer offer an action that cannot work.
    await waitFor(() => expect(result.current.detail.data?.status).toBe('cancelled'));
    await waitFor(() => expect(result.current.incoming.data?.[0]?.status).toBe('cancelled'));
    expect(result.current.outgoing.data?.[0]?.status).toBe('cancelled');
    expect(queryClient.getQueryState([...SEARCH_PAGES, { location: 'Austin' }])?.isInvalidated).toBe(true);
  });
});

describe('the booking detail', () => {
  it('does not retry a booking that is missing or not the viewer\'s', async () => {
    jest.mocked(getBookingDetail).mockRejectedValue(new BookingNotFoundError());
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useBookingDetail('not-mine'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(BookingNotFoundError);
    expect(getBookingDetail).toHaveBeenCalledTimes(1);
  });

  it('is cached per booking id, so opening another booking never shows the previous one', async () => {
    jest.mocked(getBookingDetail).mockImplementation(async (id) => ({ ...makeDetail('confirmed'), id }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(({ id }) => useBookingDetail(id), {
      wrapper,
      initialProps: { id: 'first' },
    });
    await waitFor(() => expect(result.current.data?.id).toBe('first'));

    rerender({ id: 'second' });

    // Until the second booking loads there is no data, not the first booking's.
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.id).toBe('second'));
  });
});
