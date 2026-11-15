/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { usePetPhotoUrl } from '@/features/pets';
import { BookingDetailScreen } from './BookingDetailScreen';
import { useBookingDetail, useUpdateBookingStatus } from '../hooks/useBookings';
import { BookingListingFullError, BookingNotFoundError, BookingPetUnavailableError } from '../lib/bookingErrors';
import { utcTodayIsoDate } from '../lib/bookingDates';
import type { BookingDetail } from '../lib/bookingApi';

// Explicit factories so the real hooks (and their supabase/import.meta.env chain) never load under Jest.
jest.mock('@/features/pets', () => ({
  PetAvatar: jest.requireActual('@/features/pets/components/PetAvatar').PetAvatar,
  PetCareInfo: jest.requireActual('@/features/pets/components/PetCareInfo').PetCareInfo,
  hasPetCareInfo: jest.requireActual('@/features/pets/lib/petForm').hasPetCareInfo,
  usePetPhotoUrl: jest.fn(() => ({ data: undefined })),
}));
jest.mock('../hooks/useBookings', () => ({
  useBookingDetail: jest.fn(),
  useUpdateBookingStatus: jest.fn(),
}));

const mockUseBookingDetail = useBookingDetail as jest.Mock;
const mockUseUpdateBookingStatus = useUpdateBookingStatus as jest.Mock;

type DetailQueryResult = UseQueryResult<BookingDetail, Error>;

const PET = {
  id: 'pet-1',
  name: 'Milo',
  species: 'dog' as const,
  breed: 'Corgi',
  age_year: 4,
  photo_url: null,
  description: 'Loves fetch.',
  feeding_instruction: 'Two meals a day.',
  medical_note: null,
  behavior_note: null,
  allergies: null,
  vaccination_info: null,
  special_requirement: null,
  isDeleted: false,
};

function makeDetail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'booking-1',
    status: 'pending',
    startDate: '2099-09-10',
    endDate: '2099-09-14',
    requesterNote: 'Please keep him off the sofa.',
    ownerNote: null,
    createdAt: '2099-01-01T10:00:00.000Z',
    confirmedAt: null,
    declinedAt: null,
    cancelledAt: null,
    completedAt: null,
    viewerRole: 'owner',
    listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin', status: 'published' },
    pet: PET,
    peer: { id: 'requester-1', displayName: 'Casey Ito', photoUrl: null, location: 'Nonthaburi' },
    ...overrides,
  };
}

function successResult(data: BookingDetail): DetailQueryResult {
  return { isLoading: false, isError: false, isSuccess: true, isFetching: false, data, error: null, refetch: jest.fn() } as unknown as DetailQueryResult;
}
function loadingResult(): DetailQueryResult {
  return { isLoading: true, isError: false, isSuccess: false, isFetching: true, data: undefined, error: null, refetch: jest.fn() } as unknown as DetailQueryResult;
}
function errorResult(error: Error, refetch = jest.fn()): DetailQueryResult {
  return { isLoading: false, isError: true, isSuccess: false, isFetching: false, data: undefined, error, refetch } as unknown as DetailQueryResult;
}

const mutateAsync = jest.fn();

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/bookings/booking-1']}>
      <Routes>
        <Route path="/bookings/:bookingId" element={<BookingDetailScreen />} />
        <Route path="/bookings" element={<p>Bookings list page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(usePetPhotoUrl).mockReturnValue({ data: undefined } as ReturnType<typeof usePetPhotoUrl>);
  mutateAsync.mockResolvedValue(undefined);
  mockUseUpdateBookingStatus.mockReturnValue({ mutateAsync });
});

describe('loading, failing and missing', () => {
  it('shows a loading status while the booking loads', () => {
    mockUseBookingDetail.mockReturnValue(loadingResult());

    renderScreen();

    expect(screen.getByRole('status')).toHaveTextContent(/loading booking/i);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  });

  it('asks the hook for the booking named in the URL', () => {
    mockUseBookingDetail.mockReturnValue(loadingResult());

    renderScreen();

    expect(mockUseBookingDetail).toHaveBeenCalledWith('booking-1');
  });

  it('retries after a load failure', async () => {
    const refetch = jest.fn();
    mockUseBookingDetail.mockReturnValue(errorResult(new Error('network down'), refetch));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load this booking');
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not show raw database errors', () => {
    mockUseBookingDetail.mockReturnValue(errorResult(new Error('permission denied for function get_booking_detail')));

    renderScreen();

    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument();
  });

  it('says not found, with no retry, for a missing booking or one that is not the viewer\'s', () => {
    mockUseBookingDetail.mockReturnValue(errorResult(new BookingNotFoundError()));

    renderScreen();

    expect(screen.getByRole('alert')).toHaveTextContent('Booking not found');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your bookings' })).toHaveAttribute('href', '/bookings');
  });
});

describe('what a host sees', () => {
  it('shows the stay, listing, pet with care notes, and the requester', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Booking details' })).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('4 nights')).toBeInTheDocument();
    expect(screen.getByText('booking-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cozy Yard' })).toHaveAttribute('href', '/listings/listing-1');
    expect(screen.getByText('Austin')).toBeInTheDocument();
    expect(screen.getByText('Milo')).toBeInTheDocument();
    expect(screen.getByText('Dog · Corgi · 4 yr')).toBeInTheDocument();
    expect(screen.getByText('Two meals a day.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Requester' })).toBeInTheDocument();
    expect(screen.getByText('Casey Ito')).toBeInTheDocument();
    expect(screen.getByText('Nonthaburi')).toBeInTheDocument();
    expect(screen.getByText('Please keep him off the sofa.')).toBeInTheDocument();
    expect(screen.getByText('No reply.')).toBeInTheDocument();
  });

  it('says so when the pet has no care information', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ pet: { ...PET, feeding_instruction: null } })));

    renderScreen();

    expect(screen.getByText('No care information added.')).toBeInTheDocument();
  });

  it('says the pet is no longer shared, instead of showing it, after a decline or cancellation', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ status: 'declined', pet: null })));

    renderScreen();

    expect(screen.getByText('Pet details are no longer shared.')).toBeInTheDocument();
    expect(screen.queryByText('Two meals a day.')).not.toBeInTheDocument();
  });

  it('keeps a soft-deleted pet as history', () => {
    mockUseBookingDetail.mockReturnValue(
      successResult(makeDetail({ status: 'completed', pet: { ...PET, isDeleted: true } })),
    );

    renderScreen();

    expect(screen.getByText(/owner has removed this pet from their profile/i)).toBeInTheDocument();
  });

  it('keeps a booking at an unpublished listing, without a link to it', () => {
    mockUseBookingDetail.mockReturnValue(
      successResult(makeDetail({ status: 'completed', listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin', status: 'deleted' } })),
    );

    renderScreen();

    expect(screen.getByText('Cozy Yard')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cozy Yard' })).not.toBeInTheDocument();
    expect(screen.getByText(/no longer published/i)).toBeInTheDocument();
  });

  it('falls back to an initial when the peer has no photo', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();

    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('falls back to the initial when the peer photo fails to load', async () => {
    mockUseBookingDetail.mockReturnValue(
      successResult(makeDetail({ peer: { id: 'requester-1', displayName: 'Casey Ito', photoUrl: 'https://img.test/broken.jpg', location: null } })),
    );

    const { container } = renderScreen();
    const image = container.querySelector('img[src="https://img.test/broken.jpg"]');
    expect(image).not.toBeNull();
    fireEvent.error(image as Element);

    await waitFor(() => expect(container.querySelector('img[src="https://img.test/broken.jpg"]')).toBeNull());
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('lists the activity with each recorded step', () => {
    mockUseBookingDetail.mockReturnValue(
      successResult(makeDetail({ status: 'confirmed', confirmedAt: '2099-01-02T10:00:00.000Z' })),
    );

    renderScreen();

    const activity = screen.getByRole('region', { name: 'Activity' });
    expect(within(activity).getByText('Requested')).toBeInTheDocument();
    expect(within(activity).getByText('Confirmed')).toBeInTheDocument();
    expect(within(activity).queryByText('Cancelled')).not.toBeInTheDocument();
  });
});

describe('what a requester sees', () => {
  it('shows the host, the host\'s reply, and no care notes of their own pet', () => {
    mockUseBookingDetail.mockReturnValue(
      successResult(makeDetail({
        viewerRole: 'requester',
        status: 'declined',
        ownerNote: 'Sorry, fully booked.',
        peer: { id: 'host-1', displayName: 'Alex Rivera', photoUrl: null, location: 'Chiang Mai' },
      })),
    );

    renderScreen();

    expect(screen.getByRole('heading', { name: 'Host' })).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('Sorry, fully booked.')).toBeInTheDocument();
    expect(screen.getByText('Your note')).toBeInTheDocument();
    expect(screen.queryByText('Two meals a day.')).not.toBeInTheDocument();
  });
});

describe('status actions', () => {
  it('lets the host confirm or decline a pending request', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    expect(mutateAsync).toHaveBeenNthCalledWith(1, { bookingId: 'booking-1', status: 'confirmed' });
    expect(mutateAsync).toHaveBeenNthCalledWith(2, { bookingId: 'booking-1', status: 'declined' });
  });

  it('only offers Decline once the start date has passed', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ startDate: '2000-01-01', endDate: '2000-01-05' })));

    renderScreen();

    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.getByText(/can no longer be confirmed/i)).toBeInTheDocument();
  });

  it('lets the host complete a confirmed stay from its end day', async () => {
    const today = utcTodayIsoDate();
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ status: 'confirmed', startDate: '2000-01-01', endDate: today })));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Mark completed' }));

    expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'booking-1', status: 'completed' });
  });

  it('does not offer Mark completed before the stay has ended', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ status: 'confirmed' })));

    renderScreen();

    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument();
  });

  it('offers a requester only Cancel, and never the host actions', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ viewerRole: 'requester' })));

    renderScreen();

    expect(screen.getByRole('button', { name: 'Cancel booking' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  });

  it('asks the requester to confirm before cancelling, and cancels on yes', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ viewerRole: 'requester' })));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(mutateAsync).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Cozy Yard');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'booking-1', status: 'cancelled' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('offers no actions on a finished booking', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ status: 'completed' })));

    renderScreen();

    expect(screen.queryByRole('button', { name: /confirm|decline|cancel|completed/i })).not.toBeInTheDocument();
  });

  it.each([
    ['the listing is full', new BookingListingFullError(), /listing is full/i],
    ['the pet is already booked', new BookingPetUnavailableError(), /pet already has a confirmed booking/i],
  ])('shows why a confirmation is refused when %s', async (_reason, refusal, message) => {
    mutateAsync.mockRejectedValue(refusal);
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('keeps the reason on screen after the refetch leaves no action to show', async () => {
    mutateAsync.mockRejectedValue(new BookingListingFullError());
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));
    const { rerender } = renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByRole('alert');

    // The refetch after the refusal shows the requester has cancelled in the meantime.
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ status: 'cancelled', cancelledAt: '2099-01-03T10:00:00.000Z' })));
    rerender(
      <MemoryRouter initialEntries={['/bookings/booking-1']}>
        <Routes>
          <Route path="/bookings/:bookingId" element={<BookingDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(document.querySelector('.booking-status--cancelled')).toHaveTextContent('Cancelled');
    expect(screen.getByRole('alert')).toHaveTextContent(/listing is full/i);
  });
});

describe('keyboard use', () => {
  it('reaches the back link first, then the host actions, in reading order', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Back to bookings' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Decline' })).toHaveFocus();
  });

  it('confirms with the keyboard', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();
    screen.getByRole('button', { name: 'Confirm' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(mutateAsync).toHaveBeenCalledWith({ bookingId: 'booking-1', status: 'confirmed' });
  });

  it('closes the cancel dialog with Escape without cancelling', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail({ viewerRole: 'requester' })));

    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('goes back to the list from the back link', async () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();
    await userEvent.click(screen.getByRole('link', { name: 'Back to bookings' }));

    expect(screen.getByText('Bookings list page')).toBeInTheDocument();
  });

  it('labels every section by a heading, so a screen reader can jump between them', () => {
    mockUseBookingDetail.mockReturnValue(successResult(makeDetail()));

    renderScreen();

    for (const name of ['Stay', 'Listing', 'Pet', 'Requester', 'Notes', 'Activity']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });
});
