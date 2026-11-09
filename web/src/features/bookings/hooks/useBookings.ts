import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listingKeys } from '@/features/listings';
import {
  createBookingRequest,
  listIncomingBookings,
  listOutgoingBookings,
  updateBookingStatus,
  type BookingInsert,
} from '../lib/bookingApi';
import type { Database } from '@/shared/types/database.types';

/** Bookings the current user requested. */
export function useOutgoingBookings() {
  return useQuery({
    queryKey: ['bookings', 'outgoing'],
    queryFn: listOutgoingBookings,
  });
}

/** Bookings made against listings the current user owns. */
export function useIncomingBookings() {
  return useQuery({
    queryKey: ['bookings', 'incoming'],
    queryFn: listIncomingBookings,
  });
}

export function useCreateBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: BookingInsert) => createBookingRequest(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: { bookingId: string; status: Database['public']['Enums']['booking_status'] }) =>
      updateBookingStatus(values.bookingId, values.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      // Confirming or releasing a stay changes availability in every cached search.
      void queryClient.invalidateQueries({ queryKey: listingKeys.publishedPages() });
    },
  });
}
