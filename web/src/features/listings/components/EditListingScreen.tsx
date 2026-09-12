import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Home, Image } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMyListings } from '../hooks/useListings';
import type { Listing } from '../lib/listingApi';
import { validateListingForm } from '../lib/listingForm';
import type { ListingFormErrors } from '../lib/listingForm';
import { FACILITY_OPTIONS, PET_TYPE_OPTIONS, parseFacilities, petSpeciesLabel } from '../lib/listingOptions';
import type { PetSpecies } from '../lib/listingOptions';
import { ListingsNavigation } from './ListingsNavigation';

const labelClassName = 'mb-2 block text-sm font-medium text-gray-700';

function inputClassName(hasError: boolean) {
  return `input-field ${hasError ? 'border-red-500 focus:ring-red-300' : ''}`;
}

function toggleChoice<T extends string>(value: T, selected: T[], update: (next: T[]) => void) {
  update(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
}

interface EditListingFormProps {
  listing: Listing;
}

function EditListingForm({ listing }: EditListingFormProps) {
  const navigate = useNavigate();
  // The screen renders this only after the listing has loaded, so the initial values can
  // come straight from props. If a different listing is opened the screen remounts it by key.
  const [title, setTitle] = useState(listing.title);
  const [location, setLocation] = useState(listing.location);
  const [description, setDescription] = useState(listing.description);
  const [capacity, setCapacity] = useState<number | ''>(listing.capacity);
  const [acceptedPetTypes, setAcceptedPetTypes] = useState<PetSpecies[]>(listing.accepted_pet_types);
  const [facilities, setFacilities] = useState<string[]>(() => parseFacilities(listing.facilities));
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const values = { title, location, description, capacity };
  const errors: ListingFormErrors = hasSubmitted ? validateListingForm(values) : {};

  // A stored listing may carry a pet type the form does not offer, or a facility written
  // as free text. Both are kept in state so a save cannot drop them, and shown so the
  // owner can see what the listing currently says.
  const extraPetTypes = acceptedPetTypes.filter(
    (petType) => !PET_TYPE_OPTIONS.some((option) => option.value === petType),
  );
  const petTypeOptions = [
    ...PET_TYPE_OPTIONS,
    ...extraPetTypes.map((value) => ({ value, label: petSpeciesLabel(value) })),
  ];
  const otherFacilities = facilities.filter((facility) => !FACILITY_OPTIONS.includes(facility));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setIsChecked(false);

    if (Object.keys(validateListingForm(values)).length > 0) return;

    // TODO(T-2.2.2): call the owner-authorised update mutation once that API exists.
    setIsChecked(true);
  };

  return (
    <form className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit} noValidate>
      <div>
        <label className={labelClassName} htmlFor="listing-title">Listing title <span className="text-red-700" aria-hidden="true">*</span></label>
        <input
          className={inputClassName(Boolean(errors.title))}
          id="listing-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'listing-title-error' : undefined}
        />
        {errors.title && <p className="mt-1 text-xs text-red-700" id="listing-title-error">{errors.title}</p>}
      </div>

      <div>
        <label className={labelClassName} htmlFor="listing-location">Location <span className="text-red-700" aria-hidden="true">*</span></label>
        <input
          className={inputClassName(Boolean(errors.location))}
          id="listing-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          aria-invalid={Boolean(errors.location)}
          aria-describedby={errors.location ? 'listing-location-error' : undefined}
        />
        {errors.location && <p className="mt-1 text-xs text-red-700" id="listing-location-error">{errors.location}</p>}
      </div>

      <div>
        <label className={labelClassName} htmlFor="listing-description">Description <span className="text-red-700" aria-hidden="true">*</span></label>
        <textarea
          className={inputClassName(Boolean(errors.description))}
          id="listing-description"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'listing-description-error' : undefined}
        />
        {errors.description && <p className="mt-1 text-xs text-red-700" id="listing-description-error">{errors.description}</p>}
      </div>

      <div className="max-w-xs">
        <label className={labelClassName} htmlFor="listing-capacity">Capacity <span className="text-red-700" aria-hidden="true">*</span></label>
        <input
          className={inputClassName(Boolean(errors.capacity))}
          id="listing-capacity"
          type="number"
          min="1"
          step="1"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value === '' ? '' : Number(event.target.value))}
          aria-invalid={Boolean(errors.capacity)}
          aria-describedby={errors.capacity ? 'listing-capacity-help listing-capacity-error' : 'listing-capacity-help'}
        />
        <p className="mt-1 text-xs text-gray-500" id="listing-capacity-help">Maximum number of pets hosted at one time.</p>
        {errors.capacity && <p className="mt-1 text-xs text-red-700" id="listing-capacity-error">{errors.capacity}</p>}
      </div>

      <fieldset>
        <legend className={labelClassName}>Accepted pet types</legend>
        <div className="flex flex-wrap gap-2">
          {petTypeOptions.map(({ value, label }) => {
            const isSelected = acceptedPetTypes.includes(value);
            return (
              <button
                className={`min-h-10 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-brand-500 hover:bg-brand-50'
                }`}
                type="button"
                key={value}
                aria-pressed={isSelected}
                onClick={() => toggleChoice(value, acceptedPetTypes, setAcceptedPetTypes)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={labelClassName}>Facilities</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FACILITY_OPTIONS.map((facility) => (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600" key={facility}>
              <input
                className="h-4 w-4 accent-brand-600"
                type="checkbox"
                checked={facilities.includes(facility)}
                onChange={() => toggleChoice(facility, facilities, setFacilities)}
              />
              <span className="break-words">{facility}</span>
            </label>
          ))}
        </div>
        {otherFacilities.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Also listed: </span>
            {otherFacilities.join(', ')}
          </p>
        )}
      </fieldset>

      <div>
        <span className={labelClassName}>Photos</span>
        {listing.photo_urls.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
            <Image className="h-7 w-7 text-gray-400" aria-hidden="true" />
            <span>No photos yet</span>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {listing.photo_urls.map((url, index) => (
              <li className="aspect-4/3 overflow-hidden rounded-lg border border-gray-200" key={url}>
                <img
                  className="h-full w-full object-cover"
                  src={url}
                  alt={listing.listing_images[index]?.alt_text ?? `${listing.title} photo ${index + 1}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {isChecked && (
        <p className="border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
          Changes checked successfully.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
        <button className="btn-secondary min-h-11" type="button" onClick={() => navigate('/listings')}>Cancel</button>
        <button className="btn-primary order-first min-h-11 sm:order-none" type="submit">Save changes</button>
      </div>
    </form>
  );
}

export function EditListingScreen() {
  const { listingId = '' } = useParams();
  // My listings is already the entry point and its query is cached, so the listing comes
  // from that list. Anything not in it is either missing or not the owner's — one state.
  const { data: listings, isPending, isError } = useMyListings();
  const listing = listings?.find((candidate) => candidate.id === listingId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ListingsNavigation />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/listings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my listings
        </Link>
        <div className="mb-6 mt-4">
          <p className="mb-1 text-xs font-bold uppercase text-brand-700">Hosting</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Edit listing</h1>
        </div>

        {isPending && (
          <div className="min-h-96 animate-pulse rounded-lg border border-gray-100 bg-gray-200" aria-label="Loading listing" aria-busy="true" />
        )}

        {isError && (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not load your listing</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection and Supabase environment, then refresh the page.</p>
          </section>
        )}

        {!isPending && !isError && !listing && (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not find that listing</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">It may have been removed, or it belongs to another host.</p>
            <Link className="btn-secondary mt-4" to="/listings">Back to my listings</Link>
          </section>
        )}

        {listing && <EditListingForm key={listing.id} listing={listing} />}
      </main>
    </div>
  );
}
