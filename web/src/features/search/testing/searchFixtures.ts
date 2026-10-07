import type { Listing } from '@/features/listings';

/** A published listing as `usePublishedListings` returns it: signed photo URLs, main photo first. */
export function makeSearchResult(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    owner_id: 'owner-1',
    title: 'Sunny garden room',
    location: 'Chiang Mai, Hang Dong',
    description: 'Fenced garden, quiet street, daily photo updates.',
    capacity: 2,
    accepted_pet_types: ['dog', 'cat'],
    facilities: 'Lawn',
    status: 'published',
    deleted_at: null,
    published_at: '2026-10-01T00:00:00.000Z',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    listing_images: [],
    cover_photo_url: null,
    ...overrides,
  };
}
