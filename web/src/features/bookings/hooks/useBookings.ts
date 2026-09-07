import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBookingRequest,
  listIncomingBookings,
  listOutgoingBookings,
  updateBookingStatus,
  type BookingInsert,
} from '../lib/bookingApi';
import {
  isDevMockEmpty,
  isDevMockSession,
  MOCK_INCOMING_BOOKINGS,
  MOCK_OUTGOING_BOOKINGS,
} from '../lib/mockBookings';
import type { Database } from '@/shared/types/database.types';

/** Bookings the current user requested. */
export function useOutgoingBookings() {
  const isMock = isDevMockSession();
  const isEmpty = isDevMockEmpty();

  return useQuery({
    queryKey: ['bookings', 'outgoing', isMock, isEmpty],
    queryFn: async () => {
      if (isMock) {
        return isEmpty ? [] : MOCK_OUTGOING_BOOKINGS;
      }
      return listOutgoingBookings();
    },
  });
}

/** Bookings made against listings the current user owns. */
export function useIncomingBookings() {
  const isMock = isDevMockSession();
  const isEmpty = isDevMockEmpty();

  return useQuery({
    queryKey: ['bookings', 'incoming', isMock, isEmpty],
    queryFn: async () => {
      if (isMock) {
        return isEmpty ? [] : MOCK_INCOMING_BOOKINGS;
      }
      return listIncomingBookings();
    },
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
    },
  });
}
