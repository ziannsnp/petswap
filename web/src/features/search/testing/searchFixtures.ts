import type { Listing, PublishedListingPage } from '@/features/listings';
import type { SearchCriteria } from '../lib/searchCriteria';

/**
 * The page size the app requests (`PUBLISHED_LISTINGS_PAGE_SIZE`). It is copied rather than
 * imported because search tests replace the listings module; `searchCriteria.test.ts`
 * checks that the two still agree.
 */
export const SEARCH_RESULTS_PAGE_SIZE = 9;

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

/**
 * Twenty published listings in the order `search_published_listings` returns them, newest
 * `published_at` first: two full pages of nine, then a last page of two.
 */
export const paginatedSearchListings: Listing[] = Array.from({ length: 20 }, (_, index) => {
  const number = String(20 - index).padStart(2, '0');
  return makeSearchResult({
    id: `paged-${number}`,
    title: `Paged listing ${number}`,
    published_at: `2026-09-${number}T00:00:00.000Z`,
  });
});

/**
 * One page of `listings` as `usePublishedListingPage` returns it. The page is resolved the
 * way the search RPC resolves it: a page past the end becomes the last page, and no
 * results is an empty first page. Like the RPC, it refuses a page below 1 or a fraction;
 * `readSearchPage` never asks for one.
 */
export function makeSearchPage(listings: readonly Listing[], requestedPage: number): PublishedListingPage {
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    throw new Error('Page must be a positive integer.');
  }
  const pageSize = SEARCH_RESULTS_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(listings.length / pageSize));
  const page = Math.min(requestedPage, lastPage);
  return {
    listings: listings.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: listings.length,
  };
}

export interface SearchPageCase {
  name: string;
  requestedPage: number;
  expectedPage: number;
  expectedIds: string[];
}

/** Each page a visitor can ask for in `paginatedSearchListings`, and what must be shown. */
export const searchPageCases: readonly SearchPageCase[] = [
  {
    name: 'the first page',
    requestedPage: 1,
    expectedPage: 1,
    expectedIds: ['paged-20', 'paged-19', 'paged-18', 'paged-17', 'paged-16', 'paged-15', 'paged-14', 'paged-13', 'paged-12'],
  },
  {
    name: 'a middle page',
    requestedPage: 2,
    expectedPage: 2,
    expectedIds: ['paged-11', 'paged-10', 'paged-09', 'paged-08', 'paged-07', 'paged-06', 'paged-05', 'paged-04', 'paged-03'],
  },
  { name: 'the last page, which is not full', requestedPage: 3, expectedPage: 3, expectedIds: ['paged-02', 'paged-01'] },
  { name: 'a page past the end, as the last page', requestedPage: 7, expectedPage: 3, expectedIds: ['paged-02', 'paged-01'] },
];

/** Result counts on either side of a page boundary, and the page label each one shows. */
export const pageBoundaryCases: readonly { name: string; listings: Listing[]; pageLabel: string | null }[] = [
  { name: 'nine results fit on one page', listings: paginatedSearchListings.slice(0, 9), pageLabel: null },
  { name: 'a tenth result starts a second page', listings: paginatedSearchListings.slice(0, 10), pageLabel: 'Page 1 of 2' },
  { name: 'eighteen results fill two pages', listings: paginatedSearchListings.slice(0, 18), pageLabel: 'Page 1 of 2' },
  { name: 'a nineteenth result starts a third page', listings: paginatedSearchListings.slice(0, 19), pageLabel: 'Page 1 of 3' },
];
