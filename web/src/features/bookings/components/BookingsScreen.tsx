import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useIncomingBookings, useOutgoingBookings, useUpdateBookingStatus } from '../hooks/useBookings';
import type { BookingWithDetails } from '../lib/bookingApi';
import type { Database } from '@/shared/types/database.types';

type BookingStatus = Database['public']['Enums']['booking_status'];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const SKELETON_ROWS = [0, 1] as const;

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function formatSpecies(species: string): string {
  return species.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  return <span className={`booking-status booking-status--${status}`}>{STATUS_LABELS[status]}</span>;
}

interface BookingCardProps {
  readonly booking: BookingWithDetails;
  readonly variant: 'incoming' | 'outgoing';
  readonly onConfirm?: (bookingId: string) => void;
  readonly onDecline?: (bookingId: string) => void;
  readonly isResponding?: boolean;
  readonly responseError?: string | null;
}

function BookingCard({ booking, variant, onConfirm, onDecline, isResponding, responseError }: BookingCardProps) {
  const canRespond = variant === 'incoming' && booking.status === 'pending';

  return (
    <li className="booking-card">
      <div className="booking-card__row">
        <span className="booking-card__pet">
          {booking.pet.name} <span className="booking-card__species">({formatSpecies(booking.pet.species)})</span>
        </span>
        <BookingStatusBadge status={booking.status} />
      </div>
      <p className="booking-card__listing">
        {booking.listing.title} &middot; {booking.listing.location}
      </p>
      <p className="booking-card__dates">
        {formatBookingDate(booking.start_date)} &ndash; {formatBookingDate(booking.end_date)}
      </p>
      {canRespond && (
        <div className="booking-card__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => onConfirm?.(booking.id)}
            disabled={isResponding}
          >
            {isResponding ? 'Saving...' : 'Confirm'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onDecline?.(booking.id)}
            disabled={isResponding}
          >
            Decline
          </button>
          {responseError && (
            <p className="booking-card__error" role="alert">
              {responseError}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function BookingListSkeleton() {
  return (
    <ul className="booking-list" aria-hidden="true">
      {SKELETON_ROWS.map((row) => (
        <li key={row} className="booking-card booking-card--skeleton">
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--body" />
          <div className="skeleton-line skeleton-line--body skeleton-line--short" />
        </li>
      ))}
    </ul>
  );
}

interface BookingErrorBannerProps {
  readonly message: string;
  readonly retrying: boolean;
  readonly onRetry: () => void;
}

function BookingErrorBanner({ message, retrying, onRetry }: BookingErrorBannerProps) {
  return (
    <div className="booking-error" role="alert">
      <p className="booking-error__message">{message}</p>
      <button type="button" className="booking-error__retry" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

interface BookingSectionProps {
  readonly title: string;
  readonly emptyMessage: string;
  readonly query: UseQueryResult<BookingWithDetails[], Error>;
  readonly variant: 'incoming' | 'outgoing';
  readonly onConfirm?: (bookingId: string) => void;
  readonly onDecline?: (bookingId: string) => void;
  readonly respondingId?: string | null;
  readonly responseError?: { bookingId: string; message: string } | null;
}

function BookingSection({
  title,
  emptyMessage,
  query,
  variant,
  onConfirm,
  onDecline,
  respondingId,
  responseError,
}: BookingSectionProps) {
  return (
    <section className="booking-section" aria-busy={query.isLoading}>
      <h2>{title}</h2>
      {query.isLoading && (
        <>
          <span className="sr-only" role="status">
            Loading {title.toLowerCase()}&hellip;
          </span>
          <BookingListSkeleton />
        </>
      )}
      {query.isError && (
        <BookingErrorBanner
          message={query.error.message}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && query.data.length === 0 && <p className="booking-section__status">{emptyMessage}</p>}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="booking-list">
          {query.data.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              variant={variant}
              onConfirm={onConfirm}
              onDecline={onDecline}
              isResponding={respondingId === booking.id}
              responseError={responseError?.bookingId === booking.id ? responseError.message : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BookingsScreen() {
  const outgoing = useOutgoingBookings();
  const incoming = useIncomingBookings();
  const updateStatus = useUpdateBookingStatus();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<{ bookingId: string; message: string } | null>(null);

  const noRelatedBookings =
    outgoing.isSuccess && incoming.isSuccess && outgoing.data.length === 0 && incoming.data.length === 0;

  async function respond(bookingId: string, status: 'confirmed' | 'declined') {
    setRespondingId(bookingId);
    setResponseError(null);
    try {
      await updateStatus.mutateAsync({ bookingId, status });
    } catch {
      setResponseError({ bookingId, message: 'Could not update this booking. Please try again.' });
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <main className="bookings-screen">
      <p className="eyebrow">Don't Like My Pets</p>
      <h1>Bookings</h1>
      {noRelatedBookings ? (
        <p className="booking-empty-all">
          <strong>No bookings yet.</strong> Requests you send and requests on your listings will show up here.
        </p>
      ) : (
        <>
          <BookingSection
            title="Outgoing requests"
            emptyMessage="You haven't sent any requests yet"
            query={outgoing}
            variant="outgoing"
          />
          <BookingSection
            title="Incoming requests"
            emptyMessage="No incoming requests on your listings"
            query={incoming}
            variant="incoming"
            onConfirm={(bookingId) => void respond(bookingId, 'confirmed')}
            onDecline={(bookingId) => void respond(bookingId, 'declined')}
            respondingId={respondingId}
            responseError={responseError}
          />
        </>
      )}
    </main>
  );
}
