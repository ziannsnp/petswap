import { ArrowLeft, Image } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useListing } from '../hooks/useListings';
import { petSpeciesLabel, parseFacilities } from '../lib/listingOptions';
import { ListingsNavigation } from './ListingsNavigation';

export function ListingDetailScreen() {
  const { listingId = '' } = useParams();
  const { data: listing, isPending, isError } = useListing(listingId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ListingsNavigation />
      <main className="page-container">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/listings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my listings
        </Link>

        {isPending && <p className="mt-6" role="status">Loading listing...</p>}
        {isError && (
          <section className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
            We could not load this listing. It may have been deleted or you may not have access.
          </section>
        )}

        {!isPending && !isError && listing && (
          <article className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
              <div className="aspect-video overflow-hidden rounded-lg bg-gray-100">
                {listing.cover_photo_url ? (
                  <img className="h-full w-full object-cover" src={listing.cover_photo_url} alt={listing.title} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
                    <Image className="h-9 w-9" aria-hidden="true" />
                    <span>No photo yet</span>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl font-bold">{listing.title}</h1>
                  <span className="badge-brand">{listing.status === 'draft' ? 'Draft' : 'Published'}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{listing.location}</p>
                <p className="mt-6 whitespace-pre-wrap text-gray-700">{listing.description}</p>
                <div className="mt-6 flex flex-wrap gap-2" aria-label="Accepted pet types">
                  {listing.accepted_pet_types.map((petType) => (
                    <span className="badge-brand" key={petType}>{petSpeciesLabel(petType)}</span>
                  ))}
                  <span className="badge-brand">Up to {listing.capacity} pets</span>
                </div>
                {parseFacilities(listing.facilities).length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-900">Facilities</h2>
                    <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                      {parseFacilities(listing.facilities).map((facility) => <li key={facility}>{facility}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}