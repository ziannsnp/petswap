import type { Listing, PublishedListingSort } from '@/features/listings';
import { isPetSpecies } from '@/shared/lib/petSpecies';
import type { PetSpecies } from '@/shared/lib/petSpecies';

/**
 * The applied search lives in the URL (`/?location=…&keyword=…&petType=…&sort=…`) rather than in
 * component state, so a search survives a reload, can be shared as a link, and the back button
 * steps through earlier searches. This module is the only place that knows the parameter names.
 */
export type SearchSort = PublishedListingSort;

export const DEFAULT_SEARCH_SORT: SearchSort = 'newest';

export const SEARCH_SORT_OPTIONS: readonly { value: SearchSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'capacity', label: 'Capacity (high to low)' },
];

/** Every listing holds at least one pet, so asking for one would filter nothing. */
export const SEARCH_MIN_CAPACITY_OPTIONS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];

export interface SearchCriteria {
  location: string;
  keyword: string;
  petType: PetSpecies | null;
  minCapacity: number | null;
  /** A date filter is a whole range: both dates are set, as `YYYY-MM-DD`, or neither is. */
  startDate: string | null;
  endDate: string | null;
  sort: SearchSort;
}

/** The text search; together with the filters it decides which listings match. */
export type SearchTerms = Pick<SearchCriteria, 'location' | 'keyword'>;

export type SearchFilters = Pick<SearchCriteria, 'petType' | 'minCapacity' | 'startDate' | 'endDate'>;

/** What the filter controls hold before they are applied. The keys are the URL parameter names. */
export type SearchFilterDraft = Record<keyof SearchFilters, string>;

export const EMPTY_SEARCH_CRITERIA: SearchCriteria = {
  location: '',
  keyword: '',
  petType: null,
  minCapacity: null,
  startDate: null,
  endDate: null,
  sort: DEFAULT_SEARCH_SORT,
};

export interface SearchDateError {
  field: 'startDate' | 'endDate';
  message: string;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Some engines roll 2026-02-31 over to March instead of rejecting it.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Dates in `YYYY-MM-DD` form sort as text, and the end is exclusive, as it is for a booking. */
export function findSearchDateError(startDate: string, endDate: string): SearchDateError | null {
  if (!startDate && !endDate) return null;
  if (!startDate) return { field: 'startDate', message: 'Choose both a start date and an end date.' };
  if (!endDate) return { field: 'endDate', message: 'Choose both a start date and an end date.' };
  if (!isCalendarDate(startDate)) return { field: 'startDate', message: 'Enter a valid start date.' };
  if (!isCalendarDate(endDate)) return { field: 'endDate', message: 'Enter a valid end date.' };
  if (endDate <= startDate) return { field: 'endDate', message: 'End date must be later than the start date.' };
  return null;
}

export function readSearchSort(params: URLSearchParams): SearchSort {
  const value = params.get('sort');
  return SEARCH_SORT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_SEARCH_SORT;
}

/** A value the controls could not have produced is treated as no filter, as an unknown sort is. */
export function readSearchFilters(params: URLSearchParams): SearchFilters {
  const petType = params.get('petType');
  const minCapacity = Number(params.get('minCapacity'));
  const startDate = params.get('startDate') ?? '';
  const endDate = params.get('endDate') ?? '';
  const hasDateRange = Boolean(startDate) && !findSearchDateError(startDate, endDate);
  return {
    petType: petType && isPetSpecies(petType) ? petType : null,
    minCapacity: SEARCH_MIN_CAPACITY_OPTIONS.includes(minCapacity) ? minCapacity : null,
    startDate: hasDateRange ? startDate : null,
    endDate: hasDateRange ? endDate : null,
  };
}

export function toSearchFilterDraft(filters: SearchFilters): SearchFilterDraft {
  return {
    petType: filters.petType ?? '',
    minCapacity: filters.minCapacity === null ? '' : String(filters.minCapacity),
    startDate: filters.startDate ?? '',
    endDate: filters.endDate ?? '',
  };
}

export function readSearchCriteria(params: URLSearchParams): SearchCriteria {
  return {
    location: params.get('location')?.trim() ?? '',
    keyword: params.get('keyword')?.trim() ?? '',
    ...readSearchFilters(params),
    sort: readSearchSort(params),
  };
}

export function readSearchPage(params: URLSearchParams): number {
  const value = params.get('page');
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) ? Math.min(page, 2_147_483_647) : 1;
}

/** Blank fields, unset filters, and the default sort are left out, so an empty search is the plain browse-all URL. */
export function toSearchParams(criteria: SearchCriteria, page = 1): URLSearchParams {
  const params = new URLSearchParams();
  const location = criteria.location.trim();
  const keyword = criteria.keyword.trim();
  if (location) params.set('location', location);
  if (keyword) params.set('keyword', keyword);
  if (criteria.petType) params.set('petType', criteria.petType);
  if (criteria.minCapacity !== null) params.set('minCapacity', String(criteria.minCapacity));
  if (criteria.startDate && criteria.endDate) {
    params.set('startDate', criteria.startDate);
    params.set('endDate', criteria.endDate);
  }
  if (criteria.sort !== DEFAULT_SEARCH_SORT) params.set('sort', criteria.sort);
  if (Number.isSafeInteger(page) && page > 1) params.set('page', String(page));
  return params;
}

export function isSameSearch(left: SearchCriteria, right: SearchCriteria): boolean {
  return toSearchParams(left).toString() === toSearchParams(right).toString();
}

const TIDIED_PARAMS = ['petType', 'minCapacity', 'startDate', 'endDate', 'sort', 'page'] as const;

/**
 * The URL to replace this one with when it says something other than what is applied: an
 * invalid or default value, or a page past the last one. Returns null when it already matches.
 * Blank or padded text is left alone until the same search is submitted again.
 */
export function findTidiedSearchParams(params: URLSearchParams, resolvedPage: number): URLSearchParams | null {
  const tidied = toSearchParams(readSearchCriteria(params), resolvedPage);
  return TIDIED_PARAMS.some((name) => params.get(name) !== tidied.get(name)) ? tidied : null;
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
