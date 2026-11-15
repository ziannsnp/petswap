/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import {
  BookingCancellationError,
  BookingCompletionError,
  BookingExpiredError,
  BookingListingFullError,
  BookingPetUnavailableError,
  BookingStatusChangedError,
} from '../lib/bookingErrors';
import { describeStatusChangeError, useBookingStatusChange } from './useBookingStatusChange';
import { useUpdateBookingStatus } from './useBookings';

jest.mock('./useBookings', () => ({ useUpdateBookingStatus: jest.fn() }));

const mutateAsync = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(useUpdateBookingStatus).mockReturnValue({ mutateAsync } as unknown as ReturnType<typeof useUpdateBookingStatus>);
});

describe('describeStatusChangeError', () => {
  it.each([
    new BookingListingFullError(),
    new BookingPetUnavailableError(),
    new BookingCompletionError(),
    new BookingExpiredError(),
    new BookingCancellationError(),
    new BookingStatusChangedError(),
  ])('keeps the specific message of %s', (error) => {
    expect(describeStatusChangeError(error)).toBe(error.message);
  });

  it('gives each refusal its own words', () => {
    const messages = [
      new BookingListingFullError(),
      new BookingPetUnavailableError(),
      new BookingExpiredError(),
      new BookingCancellationError(),
      new BookingStatusChangedError(),
    ].map((error) => describeStatusChangeError(error));

    expect(new Set(messages).size).toBe(messages.length);
  });

  it('hides anything it does not know behind one generic message', () => {
    expect(describeStatusChangeError(new Error('permission denied for table bookings'))).toBe(
      'Could not update this booking. Please try again.',
    );
    expect(describeStatusChangeError({ code: '23P01', detail: 'Key (pet_id)=(...) conflicts with another booking' })).toBe(
      'Could not update this booking. Please try again.',
    );
  });
});

describe('useBookingStatusChange', () => {
  it('reports success and tracks which booking is being saved', async () => {
    let finish: () => void = () => undefined;
    mutateAsync.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useBookingStatusChange());

    let outcome: Promise<boolean> = Promise.resolve(false);
    act(() => { outcome = result.current.changeStatus('booking-1', 'confirmed'); });
    expect(result.current.respondingId).toBe('booking-1');
    await act(async () => { finish(); await outcome; });

    await expect(outcome).resolves.toBe(true);
    expect(result.current.respondingId).toBeNull();
    expect(result.current.responseError).toBeNull();
    expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'booking-1', status: 'confirmed' });
  });

  it('shows a refusal against the booking that caused it and reports failure', async () => {
    mutateAsync.mockRejectedValue(new BookingListingFullError());
    const { result } = renderHook(() => useBookingStatusChange());

    let ok = true;
    await act(async () => { ok = await result.current.changeStatus('booking-1', 'confirmed'); });

    expect(ok).toBe(false);
    expect(result.current.responseError).toEqual({ bookingId: 'booking-1', message: new BookingListingFullError().message });
    expect(result.current.respondingId).toBeNull();
  });

  it('clears the previous refusal when the next attempt starts', async () => {
    mutateAsync.mockRejectedValueOnce(new BookingStatusChangedError()).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useBookingStatusChange());

    await act(async () => { await result.current.changeStatus('booking-1', 'confirmed'); });
    expect(result.current.responseError?.bookingId).toBe('booking-1');
    await act(async () => { await result.current.changeStatus('booking-1', 'declined'); });

    expect(result.current.responseError).toBeNull();
  });
});
