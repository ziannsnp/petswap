import type { Listing, PublishedListingSort } from '@/features/listings';

/**
 * The applied search lives in the URL (`/?location=…&keyword=…&sort=…`) rather than in component
 * state, so a search survives a reload, can be shared as a link, and the back button steps
 * through earlier searches. This module is the only place that knows the parameter names.
 */
export type SearchSort = PublishedListingSort;

export const DEFAULT_SEARCH_SORT: SearchSort = 'newest';

export const SEARCH_SORT_OPTIONS: readonly { value: SearchSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'capacity', label: 'Capacity (high to low)' },
];

export interface SearchCriteria {
  location: string;
  keyword: string;
  sort: SearchSort;
}

/** What decides which listings match; the sort only changes their order. */
export type SearchTerms = Pick<SearchCriteria, 'location' | 'keyword'>;

export const EMPTY_SEARCH_CRITERIA: SearchCriteria = { location: '', keyword: '', sort: DEFAULT_SEARCH_SORT };

export function readSearchSort(params: URLSearchParams): SearchSort {
  const value = params.get('sort');
  return SEARCH_SORT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_SEARCH_SORT;
}

export function readSearchCriteria(params: URLSearchParams): SearchCriteria {
  return {
    location: params.get('location')?.trim() ?? '',
    keyword: params.get('keyword')?.trim() ?? '',
    sort: readSearchSort(params),
  };
}

export function readSearchPage(params: URLSearchParams): number {
  const value = params.get('page');
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) ? Math.min(page, 2_147_483_647) : 1;
}

/** Blank fields and the default sort are left out, so an empty search is the plain browse-all URL. */
export function toSearchParams(criteria: SearchCriteria, page = 1): URLSearchParams {
  const params = new URLSearchParams();
  const location = criteria.location.trim();
  const keyword = criteria.keyword.trim();
  if (location) params.set('location', location);
  if (keyword) params.set('keyword', keyword);
  if (criteria.sort !== DEFAULT_SEARCH_SORT) params.set('sort', criteria.sort);
  if (Number.isSafeInteger(page) && page > 1) params.set('page', String(page));
  return params;
}

export function isSameSearch(left: SearchCriteria, right: SearchCriteria): boolean {
  return toSearchParams(left).toString() === toSearchParams(right).toString();
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Applies the browse/search contract to the published response. Matching is deliberately
 * done as literal text rather than constructing a PostgREST `or` filter: `%`, `_`, `\\`,
 * commas, parentheses, and quotes therefore stay ordinary user input instead of becoming
 * wildcard or filter syntax. The API still enforces the same publication predicate, while
 * this second boundary keeps a stale/mocked response from leaking a hidden listing.
 */
export function filterPublishedListings(
  listings: readonly Listing[],
  criteria: SearchTerms,
): Listing[] {
  const location = normalizeSearchText(criteria.location);
  const keyword = normalizeSearchText(criteria.keyword);

  return listings.filter((listing) => {
    if (listing.status !== 'published' || listing.deleted_at !== null) return false;

    const normalizedLocation = normalizeSearchText(listing.location);
    const normalizedTitle = normalizeSearchText(listing.title);
    const normalizedDescription = normalizeSearchText(listing.description);

    return (!location || normalizedLocation.includes(location))
      && (!keyword || normalizedTitle.includes(keyword) || normalizedDescription.includes(keyword));
  });
}
