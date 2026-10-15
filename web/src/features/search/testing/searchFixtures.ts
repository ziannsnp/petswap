import type { Listing } from '@/features/listings';
import type { SearchCriteria } from '../lib/searchCriteria';

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
    host: null,
    ...overrides,
  };
}

/**
 * Published listings for the matching rules. "garden" sits in one title and, in capitals,
 * in another listing's description, so a keyword search has to read both fields.
 */
export const searchMatchListings = [
  makeSearchResult({
    id: 'garden-room',
    title: 'Sunny Garden Room',
    location: 'Chiang Mai, Hang Dong',
    description: 'Fenced lawn and daily photo updates.',
  }),
  makeSearchResult({
    id: 'catio-studio',
    title: 'Quiet studio with catio',
    location: 'Bangkok, Sathorn',
    description: 'A calm home for indoor cats.',
  }),
  makeSearchResult({
    id: 'countryside-cottage',
    title: 'Countryside cottage',
    location: 'Phuket',
    description: 'A big GARDEN field for dogs to run.',
  }),
];

export interface SearchMatchCase {
  name: string;
  criteria: SearchCriteria;
  expectedIds: string[];
}

/** Each search against `searchMatchListings` and the ids it must return, in response order. */
export const searchMatchCases: readonly SearchMatchCase[] = [
  {
    name: 'an exact title',
    criteria: { location: '', keyword: 'Quiet studio with catio' },
    expectedIds: ['catio-studio'],
  },
  { name: 'part of a title', criteria: { location: '', keyword: 'cottage' }, expectedIds: ['countryside-cottage'] },
  { name: 'mixed-case text', criteria: { location: 'cHIANG mAI', keyword: 'sUNNY' }, expectedIds: ['garden-room'] },
  { name: 'a location', criteria: { location: 'Bangkok', keyword: '' }, expectedIds: ['catio-studio'] },
  { name: 'part of a location', criteria: { location: 'hang dong', keyword: '' }, expectedIds: ['garden-room'] },
  { name: 'a description', criteria: { location: '', keyword: 'indoor cats' }, expectedIds: ['catio-studio'] },
  {
    name: 'a keyword in a title or a description',
    criteria: { location: '', keyword: 'garden' },
    expectedIds: ['garden-room', 'countryside-cottage'],
  },
  {
    name: 'a location and a keyword together',
    criteria: { location: 'Phuket', keyword: 'garden' },
    expectedIds: ['countryside-cottage'],
  },
  {
    name: 'text with surrounding spaces',
    criteria: { location: '  bangkok ', keyword: ' catio  ' },
    expectedIds: ['catio-studio'],
  },
];

/**
 * Listings that must never be shown, however well they match: a search for "garden" would
 * find both if the published-only rule slipped.
 */
export const hiddenSearchListings = [
  makeSearchResult({
    id: 'draft-garden',
    title: 'Garden suite (draft)',
    status: 'draft',
    published_at: null,
  }),
  makeSearchResult({
    id: 'deleted-garden',
    title: 'Retired garden room',
    status: 'deleted',
    published_at: null,
    deleted_at: '2026-10-01T00:00:00.000Z',
  }),
];

/** A published listing whose owner has not added a photo yet. */
export const noPhotoSearchResult = makeSearchResult({
  id: 'no-photo',
  title: 'Spare room',
  description: 'A small spare room.',
  listing_images: [],
  cover_photo_url: null,
});

/**
 * Searches that `searchMatchListings` cannot satisfy. The last two match only a hidden
 * listing, or each field on a different listing, so they must still come back empty.
 */
export const noResultSearches: readonly { name: string; criteria: SearchCriteria }[] = [
  { name: 'a location with no listings', criteria: { location: 'Krabi', keyword: '' } },
  { name: 'a keyword no listing uses', criteria: { location: '', keyword: 'hamster' } },
  { name: 'text only a hidden listing has', criteria: { location: '', keyword: 'suite' } },
  { name: 'a location and a keyword from different listings', criteria: { location: 'Bangkok', keyword: 'garden' } },
];
