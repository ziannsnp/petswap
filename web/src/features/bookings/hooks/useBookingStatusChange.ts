import { useState } from 'react';
import {
  BookingCancellationError,
  BookingCompletionError,
  BookingConflictError,
  BookingExpiredError,
} from '../lib/bookingErrors';
import type { BookingStatus } from '../lib/bookingDisplay';
import { useUpdateBookingStatus } from './useBookings';

const GENERIC_STATUS_ERROR = 'Could not update this booking. Please try again.';

/**
 * The words shown when the database refuses a status change. Capacity-full and pet-already-booked
 * keep their own copy; neither names another booking, so nothing about anyone else leaks.
 */
export function describeStatusChangeError(error: unknown): string {
  if (
    error instanceof BookingConflictError
    || error instanceof BookingCompletionError
    || error instanceof BookingExpiredError
    || error instanceof BookingCancellationError
  ) {
    return error.message;
  }
  return GENERIC_STATUS_ERROR;
}

/**
 * Confirm, decline, cancel or complete a booking, one at a time, for the list and the detail screen.
 * A refusal is shown against the booking that caused it, and the mutation has already refetched the
 * bookings and searches by then (useUpdateBookingStatus), so the next render no longer offers an
 * action that cannot work.
 */
export function useBookingStatusChange() {
  const updateStatus = useUpdateBookingStatus();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<{ bookingId: string; message: string } | null>(null);

  async function changeStatus(bookingId: string, status: BookingStatus): Promise<boolean> {
    setRespondingId(bookingId);
    setResponseError(null);
    try {
      await updateStatus.mutateAsync({ bookingId, status });
      return true;
    } catch (error) {
      setResponseError({ bookingId, message: describeStatusChangeError(error) });
      return false;
    } finally {
      setRespondingId(null);
    }
  }

  return { changeStatus, respondingId, responseError };
}
