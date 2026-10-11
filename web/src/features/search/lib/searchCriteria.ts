import type { Listing } from '@/features/listings';

/**
 * The applied search lives in the URL (`/?location=…&keyword=…`) rather than in component
 * state, so a search survives a reload, can be shared as a link, and the back button steps
 * through earlier searches. This module is the only place that knows the parameter names.
 */
export interface SearchCriteria {
  location: string;
  keyword: string;
}

export const EMPTY_SEARCH_CRITERIA: SearchCriteria = { location: '', keyword: '' };

export function readSearchCriteria(params: URLSearchParams): SearchCriteria {
  return {
    location: params.get('location')?.trim() ?? '',
    keyword: params.get('keyword')?.trim() ?? '',
  };
}

/** Blank fields are left out, so an empty search is the plain browse-all URL. */
export function toSearchParams(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams();
  const location = criteria.location.trim();
  const keyword = criteria.keyword.trim();
  if (location) params.set('location', location);
  if (keyword) params.set('keyword', keyword);
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
  criteria: SearchCriteria,
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
