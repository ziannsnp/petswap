import { STATUS_LABELS, type BookingStatus } from '../lib/bookingDisplay';

export function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  return <span className={`booking-status booking-status--${status}`}>{STATUS_LABELS[status]}</span>;
}
