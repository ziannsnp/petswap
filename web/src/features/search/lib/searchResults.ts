export const SORT_OPTIONS = ['newest', 'oldest', 'title', 'capacity'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const DEFAULT_SORT: SortOption = 'newest';
export const PAGE_SIZE = 6;

export interface SearchListing {
  readonly title: string;
  readonly location: string;
  readonly description: string;
  readonly capacity: number;
  readonly published_at: string | null;
}

export interface SearchCriteria {
  readonly query: string;
  readonly sort: SortOption;
  readonly page: number;
}

export const DEFAULT_CRITERIA: SearchCriteria = { query: '', sort: DEFAULT_SORT, page: 1 };

export function parseSort(value: string | null): SortOption {
  return SORT_OPTIONS.find((option) => option === value) ?? DEFAULT_SORT;
}

export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function filterListings<T extends SearchListing>(listings: readonly T[], query: string): T[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [...listings];
  }
  return listings.filter((listing) => {
    const haystack = `${listing.title} ${listing.location} ${listing.description}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

function publishedTime(listing: SearchListing): number {
  return listing.published_at ? Date.parse(listing.published_at) : 0;
}

export function sortListings<T extends SearchListing>(listings: readonly T[], sort: SortOption): T[] {
  const sorted = [...listings];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => publishedTime(a) - publishedTime(b));
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'capacity':
      return sorted.sort((a, b) => b.capacity - a.capacity || publishedTime(b) - publishedTime(a));
    default:
      return sorted.sort((a, b) => publishedTime(b) - publishedTime(a));
  }
}

export interface ResultsPage<T> {
  readonly items: T[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalItems: number;
}

/** Clamps the requested page so a shrinking result set never leaves an empty page. */
export function paginate<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): ResultsPage<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, totalPages, totalItems: items.length };
}

export function getResultsPage<T extends SearchListing>(listings: readonly T[], criteria: SearchCriteria): ResultsPage<T> {
  return paginate(sortListings(filterListings(listings, criteria.query), criteria.sort), criteria.page);
}

export function changeSort(criteria: SearchCriteria, sort: SortOption): SearchCriteria {
  return { ...criteria, sort, page: 1 };
}

export function changeQuery(criteria: SearchCriteria, query: string): SearchCriteria {
  return { ...criteria, query, page: 1 };
}

export function resetCriteria(): SearchCriteria {
  return DEFAULT_CRITERIA;
}
