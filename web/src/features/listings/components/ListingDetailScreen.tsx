import { useState } from 'react';
import { ArrowLeft, Check, Home, MapPin, PawPrint } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { RequestBookingForm } from '@/features/bookings';
import { getInitials } from '@/shared/lib/initials';
import { useListing } from '../hooks/useListings';
import { listingErrorCode } from '../lib/listingErrors';
import { parseFacilities } from '../lib/listingOptions';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import { LISTING_STATUS_STYLES } from '../lib/listingStatus';
import type { ListingHost } from '../lib/listingApi';
import { ListingPhotoGallery } from './ListingPhotoGallery';

function ListingDetailLoading() {
  return (
    <div className="mt-6 grid animate-pulse grid-cols-1 gap-8 lg:grid-cols-3" aria-label="Loading listing" aria-busy="true">
      <div className="space-y-5 lg:col-span-2">
        <div className="aspect-video rounded-xl bg-gray-200" />
        <div className="h-56 rounded-xl bg-gray-200" />
      </div>
      <div className="h-72 rounded-xl bg-gray-200" />
    </div>
  );
}

function ListingUnavailable({ error, retry }: { readonly error: unknown; readonly retry: () => void }) {
  const code = listingErrorCode(error);
  const isNetworkFailure = code === 'network' || code === 'unknown';

  return (
    <section className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
      <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        {isNetworkFailure ? 'We could not load this listing' : 'Listing unavailable'}
      </h1>
      <p className="mt-2 max-w-lg text-sm text-gray-600">
        {isNetworkFailure
          ? 'Check your connection and try again. Your search and account information are unchanged.'
          : 'It may have been removed, unpublished, or the address may be incorrect.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {isNetworkFailure && <button className="btn-primary" type="button" onClick={retry}>Try again</button>}
        <Link className="btn-secondary" to="/">Browse listings</Link>
      </div>
    </section>
  );
}

function ListingHostAvatar({ host }: { readonly host: ListingHost }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (host?.photo_url && !imageFailed) {
    return (
      <img
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        src={host.photo_url}
        alt={`${host.display_name}'s profile`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800" aria-hidden="true">
      {getInitials(host.display_name)}
    </span>
  );
}

export function ListingDetailScreen() {
  const { listingId = '' } = useParams();
  const { user } = useAuth();
  const listingQuery = useListing(listingId);
  const listing = listingQuery.data;
  const isOwner = Boolean(listing && user?.id === listing.owner_id);
  const facilities = listing ? parseFacilities(listing.facilities) : [];
  const status = listing ? LISTING_STATUS_STYLES[listing.status] : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="page-container">
        <Link className="inline-flex min-h-11 items-center gap-1 text-sm text-gray-600 hover:text-brand-700" to={isOwner ? '/listings' : '/'}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {isOwner ? 'Back to my listings' : 'Back to listings'}
        </Link>

        {listingQuery.isPending && <ListingDetailLoading />}
        {listingQuery.isError && (
          <ListingUnavailable error={listingQuery.error} retry={() => { void listingQuery.refetch(); }} />
        )}

        {!listingQuery.isPending && !listingQuery.isError && listing && (
          <>
            {isOwner && listing.status !== 'published' && (
              <p className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800" role="status">
                Owner preview: this draft is hidden from browsing, search, and other users.
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <ListingPhotoGallery key={listing.id} listingTitle={listing.title} photos={listing.listing_images} />

                <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h1 className="break-words text-2xl font-bold text-gray-950 sm:text-3xl">{listing.title}</h1>
                      <p className="mt-2 flex items-start gap-1.5 text-gray-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>{listing.location}</span>
                      </p>
                    </div>
                    {isOwner && (
                      <span className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-medium ${status?.className ?? ''}`}>
                        {status?.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2" aria-label="Listing capacity and accepted pet types">
                    {listing.accepted_pet_types.map((petType) => (
                      <span className="badge-brand inline-flex items-center gap-1" key={petType}>
                        <PawPrint className="h-3.5 w-3.5" aria-hidden="true" />
                        {petSpeciesLabel(petType)}
                      </span>
                    ))}
                    <span className="badge-brand">Up to {listing.capacity} {listing.capacity === 1 ? 'pet' : 'pets'}</span>
                  </div>

                  <section className="mt-7" aria-labelledby="listing-description-heading">
                    <h2 className="text-lg font-semibold" id="listing-description-heading">About this place</h2>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-gray-700">{listing.description}</p>
                  </section>

                  <section className="mt-7" aria-labelledby="listing-facilities-heading">
                    <h2 className="text-lg font-semibold" id="listing-facilities-heading">Facilities</h2>
                    {facilities.length > 0 ? (
                      <ul className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
                        {facilities.map((facility) => (
                          <li className="flex items-start gap-2" key={facility}>
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                            <span>{facility}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No facilities have been added.</p>
                    )}
                  </section>

                  {listing.host && (
                    <section className="mt-7" aria-labelledby="listing-host-heading">
                      <h2 className="text-lg font-semibold" id="listing-host-heading">Your host</h2>
                      <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                        <ListingHostAvatar
                          key={`${listing.host.id}:${listing.host.photo_url ?? ''}`}
                          host={listing.host}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{listing.host.display_name}</p>
                          {listing.host.location && <p className="mt-0.5 text-sm text-gray-500">Based in {listing.host.location}</p>}
                        </div>
                      </div>
                    </section>
                  )}
                </article>
              </div>

              <aside className="lg:col-span-1">
                <div className="lg:sticky lg:top-24">
                  <RequestBookingForm
                    listingId={listing.id}
                    listingOwnerId={listing.owner_id}
                    acceptedPetTypes={listing.accepted_pet_types}
                  />
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
