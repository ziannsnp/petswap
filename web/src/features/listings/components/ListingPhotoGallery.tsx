import { useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Image } from 'lucide-react';
import type { ListingImage } from '../lib/listingApi';

interface ListingPhotoGalleryProps {
  readonly listingTitle: string;
  readonly photos: readonly ListingImage[];
}

function photoAltText(photo: ListingImage, title: string, index: number): string {
  return photo.alt_text?.trim() || `${title} photo ${index + 1}`;
}

export function ListingPhotoGallery({ listingTitle, photos }: ListingPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedPhotoIds, setFailedPhotoIds] = useState<ReadonlySet<string>>(new Set());
  const selectedPhoto = photos[selectedIndex];
  const hasMultiplePhotos = photos.length > 1;

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(photos.length - 1, 0)));
    setFailedPhotoIds((current) => {
      const photoIds = new Set(photos.map((photo) => photo.id));
      const next = new Set([...current].filter((photoId) => photoIds.has(photoId)));
      return next.size === current.size ? current : next;
    });
  }, [photos]);

  const selectRelativePhoto = (offset: number) => {
    if (photos.length === 0) return;
    setSelectedIndex((current) => (current + offset + photos.length) % photos.length);
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectRelativePhoto(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectRelativePhoto(1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSelectedIndex(0);
    }
    if (event.key === 'End' && photos.length > 0) {
      event.preventDefault();
      setSelectedIndex(photos.length - 1);
    }
  };

  const markPhotoFailed = (photoId: string) => {
    setFailedPhotoIds((current) => new Set(current).add(photoId));
  };

  const selectedPhotoFailed = !selectedPhoto?.signed_url || failedPhotoIds.has(selectedPhoto.id);

  return (
    <section
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      aria-label="Listing photos"
      onKeyDown={handleKeyboard}
    >
      <div className="relative aspect-[4/3] bg-gray-100 sm:aspect-video">
        {selectedPhoto && !selectedPhotoFailed ? (
          <img
            className="h-full w-full object-cover"
            src={selectedPhoto.signed_url ?? undefined}
            alt={photoAltText(selectedPhoto, listingTitle, selectedIndex)}
            onError={() => markPhotoFailed(selectedPhoto.id)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-gray-500" role="img" aria-label={`${listingTitle} photo unavailable`}>
            <Image className="h-10 w-10" aria-hidden="true" />
            <div>
              <p className="font-medium text-gray-700">Photo unavailable</p>
              <p className="mt-1 text-sm">The listing details are still available below.</p>
            </div>
          </div>
        )}

        {hasMultiplePhotos && (
          <>
            <button
              className="absolute left-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              type="button"
              onClick={() => selectRelativePhoto(-1)}
              aria-label="Show previous photo"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className="absolute right-3 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-gray-800 shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              type="button"
              onClick={() => selectRelativePhoto(1)}
              aria-label="Show next photo"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}

        {photos.length > 0 && (
          <p className="absolute bottom-3 right-3 rounded-full bg-gray-950/75 px-3 py-1 text-xs font-medium text-white" aria-live="polite">
            {selectedIndex + 1} / {photos.length}
          </p>
        )}
      </div>

      {hasMultiplePhotos && (
        <div className="flex gap-2 overflow-x-auto p-3" role="tablist" aria-label="Choose listing photo">
          {photos.map((photo, index) => {
            const failed = !photo.signed_url || failedPhotoIds.has(photo.id);
            return (
              <button
                className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  index === selectedIndex ? 'border-brand-600' : 'border-transparent hover:border-gray-300'
                }`}
                type="button"
                role="tab"
                aria-selected={index === selectedIndex}
                aria-label={`Show photo ${index + 1} of ${photos.length}`}
                onClick={() => setSelectedIndex(index)}
                key={photo.id}
              >
                {!failed ? (
                  <img
                    className="h-full w-full object-cover"
                    src={photo.signed_url ?? undefined}
                    alt=""
                    onError={() => markPhotoFailed(photo.id)}
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-gray-400">
                    <Image className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
