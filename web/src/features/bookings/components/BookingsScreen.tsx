import type { UseQueryResult } from '@tanstack/react-query';
import { useIncomingBookings, useOutgoingBookings } from '../hooks/useBookings';
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

function BookingCard({ booking }: { readonly booking: BookingWithDetails }) {
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
}

function BookingSection({ title, emptyMessage, query }: BookingSectionProps) {
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
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function BookingsScreen() {
  const outgoing = useOutgoingBookings();
  const incoming = useIncomingBookings();

  const noRelatedBookings =
    outgoing.isSuccess && incoming.isSuccess && outgoing.data.length === 0 && incoming.data.length === 0;

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
          <BookingSection title="Outgoing requests" emptyMessage="You haven't sent any requests yet" query={outgoing} />
          <BookingSection
            title="Incoming requests"
            emptyMessage="No incoming requests on your listings"
            query={incoming}
          />
        </>
      )}
    </main>
  );
}
