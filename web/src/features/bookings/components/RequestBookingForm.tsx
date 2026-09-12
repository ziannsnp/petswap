import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useMyPets } from '@/features/pets';
import { validateBookingRequestForm } from '../lib/bookingRequestForm';
import type { BookingRequestFormErrors } from '../lib/bookingRequestForm';
import { useCreateBookingRequest } from '../hooks/useBookings';

function formatSpecies(species: string): string {
  return species.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

export interface RequestBookingFormProps {
  readonly listingId: string;
  readonly listingOwnerId: string;
  readonly acceptedPetTypes: readonly string[];
}

const labelClassName = 'mb-2 block text-sm font-medium text-gray-700';

function inputClassName(hasError: boolean) {
  return `input-field ${hasError ? 'border-red-500 focus:ring-red-300' : ''}`;
}

export function RequestBookingForm({ listingId, listingOwnerId, acceptedPetTypes }: RequestBookingFormProps) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const myPetsQuery = useMyPets();
  const createBookingRequestMutation = useCreateBookingRequest();
  const [petId, setPetId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const errors: BookingRequestFormErrors = hasSubmitted
    ? validateBookingRequestForm({ petId, startDate, endDate })
    : {};

  if (!isAuthenticated || !user) {
    return (
      <section className="booking-request" aria-label="Request a booking">
        <p className="text-sm text-gray-600">
          <Link className="font-medium text-brand-600 hover:underline" to="/login" state={{ from: location }}>
            Log in
          </Link>{' '}
          to request a booking at this listing.
        </p>
      </section>
    );
  }

  if (user.id === listingOwnerId) {
    return null;
  }

  const eligiblePets = (myPetsQuery.data ?? []).filter((pet) => acceptedPetTypes.includes(pet.species));

  const resetMutationState = () => {
    if (createBookingRequestMutation.isError) createBookingRequestMutation.reset();
    setIsSent(false);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    const nextErrors = validateBookingRequestForm({ petId, startDate, endDate });
    if (Object.keys(nextErrors).length > 0 || !user) return;

    try {
      await createBookingRequestMutation.mutateAsync({
        listing_id: listingId,
        pet_id: petId,
        requester_id: user.id,
        start_date: startDate,
        end_date: endDate,
      });
      setIsSent(true);
      setHasSubmitted(false);
      setStartDate('');
      setEndDate('');
    } catch {
      // The mutation exposes its translated error below.
    }
  }

  return (
    <section className="booking-request mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label="Request a booking">
      <h2 className="text-lg font-semibold text-gray-900">Request a booking</h2>

      {myPetsQuery.isLoading && <p className="mt-2 text-sm text-gray-500">Loading your pets&hellip;</p>}

      {myPetsQuery.isSuccess && eligiblePets.length === 0 && (
        <p className="mt-2 text-sm text-gray-600">
          None of your pets match what this listing accepts. <Link className="font-medium text-brand-600 hover:underline" to="/pets">Add a pet</Link> to request a booking.
        </p>
      )}

      {myPetsQuery.isSuccess && eligiblePets.length > 0 && (
        isSent ? (
          <p className="mt-3 border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
            Your booking request has been sent to the host.
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label className={labelClassName} htmlFor="booking-pet">Pet</label>
              <select
                className={inputClassName(Boolean(errors.petId))}
                id="booking-pet"
                value={petId}
                onChange={(event) => { resetMutationState(); setPetId(event.target.value); }}
                disabled={createBookingRequestMutation.isPending}
                aria-invalid={Boolean(errors.petId)}
                aria-describedby={errors.petId ? 'booking-pet-error' : undefined}
              >
                <option value="">Choose a pet</option>
                {eligiblePets.map((pet) => (
                  <option value={pet.id} key={pet.id}>
                    {pet.name} ({formatSpecies(pet.species)})
                  </option>
                ))}
              </select>
              {errors.petId && <p className="mt-1 text-xs text-red-700" id="booking-pet-error">{errors.petId}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClassName} htmlFor="booking-start-date">Start date</label>
                <input
                  className={inputClassName(Boolean(errors.startDate))}
                  id="booking-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => { resetMutationState(); setStartDate(event.target.value); }}
                  disabled={createBookingRequestMutation.isPending}
                  aria-invalid={Boolean(errors.startDate)}
                  aria-describedby={errors.startDate ? 'booking-start-date-error' : undefined}
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-700" id="booking-start-date-error">{errors.startDate}</p>}
              </div>

              <div>
                <label className={labelClassName} htmlFor="booking-end-date">End date</label>
                <input
                  className={inputClassName(Boolean(errors.endDate))}
                  id="booking-end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => { resetMutationState(); setEndDate(event.target.value); }}
                  disabled={createBookingRequestMutation.isPending}
                  aria-invalid={Boolean(errors.endDate)}
                  aria-describedby={errors.endDate ? 'booking-end-date-error' : undefined}
                />
                {errors.endDate && <p className="mt-1 text-xs text-red-700" id="booking-end-date-error">{errors.endDate}</p>}
              </div>
            </div>

            {createBookingRequestMutation.isError && (
              <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                We could not send your booking request. Check your connection and try again.
              </p>
            )}

            <button
              className="btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={createBookingRequestMutation.isPending}
            >
              {createBookingRequestMutation.isPending ? 'Sending request...' : 'Request booking'}
            </button>
          </form>
        )
      )}
    </section>
  );
}
