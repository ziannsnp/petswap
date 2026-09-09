import { Home, Image, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useMyListings } from '../hooks/useListings';
import type { Listing } from '../lib/listingApi';
import { ListingsNavigation } from './ListingsNavigation';

const STATUS_STYLES: Record<Listing['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-50 text-yellow-700' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700' },
  deleted: { label: 'Deleted', className: 'bg-red-50 text-red-700' },
};

function ListingCard({ listing }: { listing: Listing }) {
  const status = STATUS_STYLES[listing.status];

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
            <span className="badge-brand" key={petType}>{petType}</span>
          ))}
          <span className="badge-brand">Up to {listing.capacity} pets</span>
        </div>
      </div>
    </article>
  );
}

export function ListingsScreen() {
  const { user } = useAuth();
  const { data: listings = [], isPending, isError } = useMyListings(user?.id);
  const activeListings = listings.filter((listing) => listing.status !== 'deleted');

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
