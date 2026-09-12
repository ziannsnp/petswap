import { Home, Image, Pencil, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useMyListings } from '../hooks/useListings';
import { petSpeciesLabel } from '../lib/listingOptions';
import { LISTING_STATUS_STYLES } from '../lib/listingStatus';
import type { Listing } from '../lib/listingApi';
import { ListingsNavigation } from './ListingsNavigation';

function ListingCard({ listing }: { listing: Listing }) {
  const status = LISTING_STATUS_STYLES[listing.status];

  // The preview link and the edit link are siblings: an anchor cannot contain another
  // anchor, so the card body is one link and the owner action sits in its own footer.
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:border-brand-500">
      <Link className="block" to={`/listings/${listing.id}`}>
        <div className="aspect-video bg-gray-100">
          {listing.cover_photo_url ? (
            <img
              className="h-full w-full object-cover"
              src={listing.cover_photo_url}
              alt={listing.listing_images[0]?.alt_text ?? listing.title}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <Image className="h-9 w-9" aria-hidden="true" />
              <span>No photo yet</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-base font-semibold text-gray-900 break-words">{listing.title}</h2>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{listing.location}</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Listing details">
            {listing.accepted_pet_types.map((petType) => (
              <span className="badge-brand" key={petType}>{petSpeciesLabel(petType)}</span>
            ))}
            <span className="badge-brand">Up to {listing.capacity} pets</span>
          </div>
        </div>
      </Link>
      <div className="flex justify-end border-t border-gray-100 px-4 py-3">
        <Link
          className="btn-secondary inline-flex items-center gap-1.5 text-sm"
          to={`/listings/${listing.id}/edit`}
          aria-label={`Edit listing ${listing.id}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
      </div>
    </article>
  );
}

export function ListingsScreen() {
  const location = useLocation();
  const { data: listings = [], isPending, isError } = useMyListings();
  const activeListings = listings.filter((listing) => listing.status !== 'deleted');
  const listingSaved = location.state?.listingSaved === 'draft' || location.state?.listingSaved === 'published'
    ? location.state.listingSaved
    : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ListingsNavigation />
      <main className="page-container">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-brand-700">Hosting</p>
            <h1 className="text-2xl font-bold sm:text-3xl">My listings</h1>
          </div>
          <Link className="btn-primary flex min-h-11 items-center justify-center gap-2" to="/listings/new">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Create listing</span>
            <span className="sr-only sm:hidden">Create listing</span>
          </Link>
        </div>

        {listingSaved && (
          <p className="mb-6 border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {listingSaved === 'published'
              ? 'Listing published successfully. Pet owners can now discover it.'
              : 'Draft saved successfully. Only you can view it until you publish it.'}
          </p>
        )}

        {isPending && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2" aria-label="Loading listings" aria-busy="true">
            {[0, 1].map((item) => (
              <div className="min-h-80 animate-pulse rounded-lg border border-gray-100 bg-gray-200" key={item} />
            ))}
          </div>
        )}

        {isError && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not load your listings</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection and Supabase environment, then refresh the page.</p>
          </section>
        )}

        {!isPending && !isError && activeListings.length === 0 && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No listings yet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Create your first place listing to offer in-home pet care.</p>
            <Link className="btn-secondary mt-4" to="/listings/new">Create your first listing</Link>
          </section>
        )}

        {!isPending && !isError && activeListings.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </main>
    </div>
  );
}
