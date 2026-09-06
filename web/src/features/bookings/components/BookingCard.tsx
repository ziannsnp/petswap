import type { UseQueryResult } from "@tanstack/react-query";
import { useIncomingBookings, useOutgoingBookings } from "../hooks/useBookings";
import type { BookingWithDetails } from "../lib/bookingApi";
import type { Database } from "@/shared/types/database.types";
type BookingStatus = Database["public"]["Enums"]["booking_status"];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function formatSpecies(species: string): string {
  return species
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  return (
    <span className={`booking-status booking-status--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function BookingCard({
  booking,
}: {
  readonly booking: BookingWithDetails;
}) {
  return (
    <li className="booking-card">
      <div className="booking-card__row">
        <span className="booking-card__pet">
          {booking.pet.name}{" "}
          <span className="booking-card__species">
            ({formatSpecies(booking.pet.species)})
          </span>
        </span>
        <BookingStatusBadge status={booking.status} />
      </div>
      <p className="booking-card__listing">
        {booking.listing.title} &middot; {booking.listing.location}
      </p>
      <p className="booking-card__dates">
        {formatBookingDate(booking.start_date)} &ndash;{" "}
        {formatBookingDate(booking.end_date)}
      </p>
    </li>
  );
}
