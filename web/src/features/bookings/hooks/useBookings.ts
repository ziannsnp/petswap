import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listingKeys } from '@/features/listings';
import {
  createBookingRequest,
  getBookingDetail,
  listIncomingBookings,
  listOutgoingBookings,
  updateBookingStatus,
  type BookingInsert,
} from '../lib/bookingApi';
import { BookingNotFoundError } from '../lib/bookingErrors';
import type { Database } from '@/shared/types/database.types';

/**
 * Every booking query key starts with 'bookings', so one prefix invalidates the lists and every
 * open detail, and the sign-in cache purge (setSessionCache) drops them all when the signed-in
 * account changes: bookings are never shown across accounts.
 */
export const bookingKeys = {
  all: ['bookings'] as const,
  outgoing: () => [...bookingKeys.all, 'outgoing'] as const,
  incoming: () => [...bookingKeys.all, 'incoming'] as const,
  detail: (bookingId: string) => [...bookingKeys.all, 'detail', bookingId] as const,
};

/** Bookings the current user requested. */
export function useOutgoingBookings() {
  return useQuery({
    queryKey: bookingKeys.outgoing(),
    queryFn: listOutgoingBookings,
  });
}

/** Bookings made against listings the current user owns. */
export function useIncomingBookings() {
  return useQuery({
    queryKey: bookingKeys.incoming(),
    queryFn: listIncomingBookings,
  });
}

/** One booking for its requester or the listing owner; an outsider or unknown id is a not-found error. */
export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => getBookingDetail(bookingId),
    // Retrying a not-found only repeats the same answer.
    retry: (failureCount, error) => !(error instanceof BookingNotFoundError) && failureCount < 2,
  });
}

export function useCreateBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: BookingInsert) => createBookingRequest(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: { bookingId: string; status: Database['public']['Enums']['booking_status'] }) =>
      updateBookingStatus(values.bookingId, values.status),
    // Success and failure both refresh. A refusal (listing full, pet already booked, expired,
    // already cancelled...) means what the screen showed was stale, so the lists, the open detail and
    // the cached searches are refetched instead of leaving an action that can no longer work.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      // Confirming or releasing a stay changes availability in every cached search.
      void queryClient.invalidateQueries({ queryKey: listingKeys.publishedPages() });
    },
  });
}
