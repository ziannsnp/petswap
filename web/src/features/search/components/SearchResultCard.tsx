import { useId, useState } from 'react';
import { Image, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Listing } from '@/features/listings';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';

interface SearchResultCardProps {
  listing: Listing;
}

export function SearchResultCard({ listing }: SearchResultCardProps) {
  const titleId = useId();
  // Remembers which URL failed rather than a flag, so a refreshed signed URL for the same
  // listing gets a fresh attempt instead of staying on the placeholder.
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photoUrl = listing.cover_photo_url;

  return (
    <article className="card-hover h-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-brand-500">
      {/* The whole card is the link, so the photo is a click target too. Its accessible
          name comes from the title alone rather than from every line of text in the card. */}
      <Link className="block h-full outline-none" to={`/listings/${listing.id}`} aria-labelledby={titleId}>
        <div className="h-48 bg-gray-100">
          {photoUrl && photoUrl !== failedPhotoUrl ? (
            <img
              className="h-full w-full object-cover"
              src={photoUrl}
              alt={listing.listing_images[0]?.alt_text ?? listing.title}
              onError={() => setFailedPhotoUrl(photoUrl)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <Image className="h-9 w-9" aria-hidden="true" />
              <span>{photoUrl ? 'Photo unavailable' : 'No photo yet'}</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold break-words text-gray-900" id={titleId}>{listing.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {listing.location}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Pets accepted">
            {listing.accepted_pet_types.map((petType) => (
              <li className="badge-brand" key={petType}>{petSpeciesLabel(petType)}</li>
            ))}
            <li className="badge-brand">Up to {listing.capacity} {listing.capacity === 1 ? 'pet' : 'pets'}</li>
          </ul>
        </div>
      </Link>
    </article>
  );
}
