import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PetAvatar, PetCareInfo, hasPetCareInfo, usePetPhotoUrl } from '@/features/pets';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import { useBookingStatusChange } from '../hooks/useBookingStatusChange';
import { useBookingDetail } from '../hooks/useBookings';
import { utcTodayIsoDate } from '../lib/bookingDates';
import { countNights, formatBookingDate, formatBookingTimestamp } from '../lib/bookingDisplay';
import { BookingNotFoundError } from '../lib/bookingErrors';
import { canCancelBooking, canCompleteBooking, canConfirmBooking } from '../lib/bookingRules';
import type { BookingDetail, BookingDetailPeer, BookingDetailPet } from '../lib/bookingApi';
import { BookingStatusBadge } from './BookingStatusBadge';
import { CancelBookingDialog } from './CancelBookingDialog';

const sectionClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5';
const sectionTitleClass = 'mb-3 text-lg font-bold text-gray-800';

function BookingDetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-hidden="true">
      <div className="skeleton-line skeleton-line--title" />
      <div className="booking-card booking-card--skeleton">
        <div className="skeleton-line skeleton-line--body" />
        <div className="skeleton-line skeleton-line--body skeleton-line--short" />
      </div>
      <div className="booking-card booking-card--skeleton">
        <div className="skeleton-line skeleton-line--body" />
        <div className="skeleton-line skeleton-line--body skeleton-line--short" />
      </div>
    </div>
  );
}

function PeerAvatar({ peer }: { readonly peer: BookingDetailPeer }) {
  // Remembers which URL failed, so a new URL gets its own chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = Boolean(peer.photoUrl) && peer.photoUrl !== failedSrc;

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50 text-lg font-bold text-brand-700">
      {showPhoto && peer.photoUrl ? (
        <img
          className="h-full w-full object-cover"
          src={peer.photoUrl}
          alt=""
          onError={() => setFailedSrc(peer.photoUrl)}
        />
      ) : (
        <span aria-hidden="true">{peer.displayName.trim().charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function PetSection({ pet, viewerRole }: { readonly pet: BookingDetailPet | null; readonly viewerRole: BookingDetail['viewerRole'] }) {
  const photo = usePetPhotoUrl(pet?.photo_url ?? null);

  if (!pet) {
    return (
      <section className={sectionClass} aria-labelledby="booking-detail-pet">
        <h2 id="booking-detail-pet" className={sectionTitleClass}>Pet</h2>
        <p className="text-sm text-gray-500">Pet details are no longer shared.</p>
      </section>
    );
  }

  const facts = [petSpeciesLabel(pet.species), pet.breed, pet.age_year !== null ? `${pet.age_year} yr` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={sectionClass} aria-labelledby="booking-detail-pet">
      <h2 id="booking-detail-pet" className={sectionTitleClass}>Pet</h2>
      <div className="flex items-center gap-3">
        <PetAvatar
          src={photo.data}
          alt={photo.data ? `Photo of ${pet.name}` : ''}
          className="h-14 w-14"
          iconClassName="h-6 w-6"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{pet.name}</p>
          <p className="text-sm text-gray-500">{facts}</p>
        </div>
      </div>
      {pet.isDeleted && (
        <p className="mt-3 text-sm text-gray-500">
          {viewerRole === 'requester'
            ? 'You have removed this pet from your profile. It stays here as part of the booking history.'
            : 'The owner has removed this pet from their profile. It stays here as part of the booking history.'}
        </p>
      )}
      {pet.description?.trim() && <p className="mt-3 text-sm text-gray-700">{pet.description}</p>}
      {/* FR-2.2: the host reads the care notes on the booking; the requester owns the pet. */}
      {viewerRole === 'owner' && (hasPetCareInfo(pet) ? (
        <PetCareInfo pet={pet} className="mt-3 border-t border-gray-100 pt-3" />
      ) : (
        <p className="mt-3 text-sm text-gray-500">No care information added.</p>
      ))}
    </section>
  );
}

function ActivityList({ booking }: { readonly booking: BookingDetail }) {
  const entries = [
    { label: 'Requested', at: booking.createdAt },
    { label: 'Confirmed', at: booking.confirmedAt },
    { label: 'Declined', at: booking.declinedAt },
    { label: 'Cancelled', at: booking.cancelledAt },
    { label: 'Completed', at: booking.completedAt },
  ].filter((entry): entry is { label: string; at: string } => entry.at !== null);

  return (
    <section className={sectionClass} aria-labelledby="booking-detail-activity">
      <h2 id="booking-detail-activity" className={sectionTitleClass}>Activity</h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-gray-700">
        {entries.map((entry) => (
          <li key={entry.label}>
            <span className="font-semibold">{entry.label}</span> {formatBookingTimestamp(entry.at)}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DetailActionsProps {
  readonly booking: BookingDetail;
  readonly today: string;
  readonly isResponding: boolean;
  readonly onConfirm: () => void;
  readonly onDecline: () => void;
  readonly onComplete: () => void;
  readonly onCancel: () => void;
}

function DetailActions({ booking, today, isResponding, onConfirm, onDecline, onComplete, onCancel }: DetailActionsProps) {
  const isOwner = booking.viewerRole === 'owner';
  const canRespond = isOwner && booking.status === 'pending';
  const canConfirm = canRespond && canConfirmBooking({ status: booking.status, startDate: booking.startDate }, today);
  const canComplete = isOwner && canCompleteBooking({ status: booking.status, endDate: booking.endDate }, today);
  const canCancel = !isOwner && canCancelBooking({ status: booking.status, endDate: booking.endDate }, today);

  if (!canRespond && !canComplete && !canCancel) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canRespond && (canConfirm ? (
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={isResponding}>
          {isResponding ? 'Saving...' : 'Confirm'}
        </button>
      ) : (
        <p className="w-full text-sm text-gray-600">
          The start date has passed, so this request can no longer be confirmed. Decline it to close it.
        </p>
      ))}
      {canRespond && (
        <button type="button" className="btn-secondary" onClick={onDecline} disabled={isResponding}>
          Decline
        </button>
      )}
      {canComplete && (
        <button type="button" className="btn-primary" onClick={onComplete} disabled={isResponding}>
          {isResponding ? 'Saving...' : 'Mark completed'}
        </button>
      )}
      {canCancel && (
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isResponding}>
          {isResponding ? 'Saving...' : 'Cancel booking'}
        </button>
      )}
    </div>
  );
}

function BookingDetailBody({ booking }: { readonly booking: BookingDetail }) {
  const { changeStatus, respondingId, responseError } = useBookingStatusChange();
  const [isCancelling, setIsCancelling] = useState(false);
  // The database's UTC day decides what is allowed, so the buttons never offer a refused action (ADR 0011).
  const today = utcTodayIsoDate();
  const nights = countNights(booking.startDate, booking.endDate);
  const peerRole = booking.viewerRole === 'requester' ? 'Host' : 'Requester';
  const listingAvailable = booking.listing.status === 'published';

  return (
    <div className="flex flex-col gap-4">
      <section className={sectionClass} aria-labelledby="booking-detail-stay">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="booking-detail-stay" className="text-lg font-bold text-gray-800">Stay</h2>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="font-semibold text-gray-900">
          {formatBookingDate(booking.startDate)} &ndash; {formatBookingDate(booking.endDate)}
        </p>
        <p className="text-sm text-gray-500">
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
        <p className="mt-3 break-all text-xs text-gray-500">
          Booking ID <span className="font-mono">{booking.id}</span>
        </p>
        <div className="mt-4">
          <DetailActions
            booking={booking}
            today={today}
            isResponding={respondingId === booking.id}
            onConfirm={() => void changeStatus(booking.id, 'confirmed')}
            onDecline={() => void changeStatus(booking.id, 'declined')}
            onComplete={() => void changeStatus(booking.id, 'completed')}
            onCancel={() => setIsCancelling(true)}
          />
        </div>
        {/* Outside the actions: a refusal refetches the booking, which may leave no action to show,
            and the reason must stay readable. */}
        {responseError?.bookingId === booking.id && (
          <p className="booking-card__error mt-3" role="alert">
            {responseError.message}
          </p>
        )}
      </section>

      <section className={sectionClass} aria-labelledby="booking-detail-listing">
        <h2 id="booking-detail-listing" className={sectionTitleClass}>Listing</h2>
        {listingAvailable ? (
          <Link className="font-semibold text-brand-700 underline-offset-2 hover:underline" to={`/listings/${booking.listing.id}`}>
            {booking.listing.title}
          </Link>
        ) : (
          <p className="font-semibold text-gray-900">{booking.listing.title}</p>
        )}
        <p className="text-sm text-gray-500">{booking.listing.location}</p>
        {!listingAvailable && (
          <p className="mt-2 text-sm text-gray-500">
            This listing is no longer published. The booking stays here as history.
          </p>
        )}
      </section>

      <PetSection pet={booking.pet} viewerRole={booking.viewerRole} />

      <section className={sectionClass} aria-labelledby="booking-detail-peer">
        <h2 id="booking-detail-peer" className={sectionTitleClass}>{peerRole}</h2>
        <div className="flex items-center gap-3">
          <PeerAvatar peer={booking.peer} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{booking.peer.displayName}</p>
            {booking.peer.location && <p className="text-sm text-gray-500">{booking.peer.location}</p>}
          </div>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="booking-detail-notes">
        <h2 id="booking-detail-notes" className={sectionTitleClass}>Notes</h2>
        <dl className="m-0 flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-semibold text-gray-700">
              {booking.viewerRole === 'requester' ? 'Your note' : 'Note from the requester'}
            </dt>
            <dd className="m-0 text-gray-700">{booking.requesterNote?.trim() || 'No note.'}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">
              {booking.viewerRole === 'owner' ? 'Your reply' : 'Reply from the host'}
            </dt>
            <dd className="m-0 text-gray-700">{booking.ownerNote?.trim() || 'No reply.'}</dd>
          </div>
        </dl>
      </section>

      <ActivityList booking={booking} />

      {isCancelling && (
        <CancelBookingDialog
          booking={{
            pet: booking.pet ? { name: booking.pet.name } : null,
            listing: { title: booking.listing.title },
            start_date: booking.startDate,
            end_date: booking.endDate,
          }}
          isOpen
          onClose={() => setIsCancelling(false)}
          onConfirm={async () => {
            await changeStatus(booking.id, 'cancelled');
          }}
        />
      )}
    </div>
  );
}

export function BookingDetailScreen() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const query = useBookingDetail(bookingId);

  return (
    <main className="bookings-screen" aria-busy={query.isLoading}>
      <Link className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/bookings">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to bookings
      </Link>
      <h1>Booking details</h1>
      {query.isLoading && (
        <>
          <span className="sr-only" role="status">
            Loading booking&hellip;
          </span>
          <BookingDetailSkeleton />
        </>
      )}
      {query.isError && query.error instanceof BookingNotFoundError && (
        <div className="booking-empty-all" role="alert">
          <p>
            <strong>Booking not found.</strong> {query.error.message}
          </p>
          <Link className="mt-3 inline-block font-semibold text-brand-700 hover:underline" to="/bookings">
            Go to your bookings
          </Link>
        </div>
      )}
      {query.isError && !(query.error instanceof BookingNotFoundError) && (
        <div className="booking-error" role="alert">
          <p className="booking-error__message">Could not load this booking. Please try again.</p>
          <button
            type="button"
            className="booking-error__retry"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            {query.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {query.isSuccess && <BookingDetailBody booking={query.data} />}
    </main>
  );
}
