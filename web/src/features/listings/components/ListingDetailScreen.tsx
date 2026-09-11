import { ArrowLeft, Image } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useListing } from '../hooks/useListings';
import { petSpeciesLabel } from '../lib/listingOptions';
import { ListingsNavigation } from './ListingsNavigation';
import { STATUS_STYLES } from './listingStatus';

export function ListingDetailScreen() {
  const { listingId = '' } = useParams();
  const { user } = useAuth();
  const { data: listing, isPending, isError } = useListing(listingId);
  const status = listing ? STATUS_STYLES[listing.status] : null;
  const isOwner = listing?.owner_id === user?.id;
  const backDestination = isOwner ? '/listings' : '/';
  const backLabel = isOwner ? 'Back to my listings' : 'Back to listings';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ListingsNavigation />
      <main className="page-container">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to={backDestination}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {backLabel}
        </Link>

        {isPending && <p className="mt-6" role="status">Loading listing...</p>}
        {isError && (
          <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
            We could not load this listing. It may have been deleted or you may not have access.
          </section>
        )}

        {!isPending && !isError && listing && (
          <article className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Listing photos">
                {listing.listing_images.length > 0 ? listing.listing_images.map((photo, index) => (
                  <div className={`${index === 0 ? 'md:row-span-2' : ''} aspect-video overflow-hidden rounded-lg bg-gray-100`} key={photo.id}>
                    <img
                      className="h-full w-full object-cover"
                      src={photo.signed_url}
                      alt={photo.alt_text ?? `${listing.title} photo ${index + 1}`}
                    />
                  </div>
                )) : (
                  <div className="flex aspect-video h-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 text-sm text-gray-400 md:col-span-2">
                    <Image className="h-9 w-9" aria-hidden="true" />
                    <span>No photo yet</span>
                  </div>
                )}
              </div>

              <div className="mt-7 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-bold">{listing.title}</h1>
                    {isOwner && <span className={`badge-brand ${status?.className ?? ''}`}>{status?.label}</span>}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{listing.location}</p>
                  <p className="mt-6 whitespace-pre-wrap text-gray-700">{listing.description}</p>
                  <div className="mt-6 flex flex-wrap gap-2" aria-label="Accepted pet types">
                    {listing.accepted_pet_types.map((petType) => (
                      <span className="badge-brand" key={petType}>{petSpeciesLabel(petType)}</span>
                    ))}
                    <span className="badge-brand">Up to {listing.capacity} pets</span>
                  </div>
                  {listing.facilities && (
                    <div className="mt-6">
                      <h2 className="text-sm font-semibold text-gray-900">Facilities</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{listing.facilities}</p>
                    </div>
                  )}
                </div>

                <aside className="h-fit rounded-lg border border-gray-200 bg-gray-50 p-4" aria-label="Host profile">
                  <h2 className="text-sm font-semibold text-gray-900">Hosted by</h2>
                  <div className="mt-3 flex items-center gap-3">
                    {listing.host.photo_url ? (
                      <img className="h-12 w-12 rounded-full object-cover" src={listing.host.photo_url} alt={listing.host.display_name} />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700" aria-hidden="true">
                        {listing.host.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{listing.host.display_name}</p>
                      {listing.host.location && <p className="text-sm text-gray-500">{listing.host.location}</p>}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
