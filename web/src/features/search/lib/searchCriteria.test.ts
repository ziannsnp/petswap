import { PUBLISHED_LISTINGS_PAGE_SIZE } from '@/features/listings';
import { DEFAULT_SEARCH_SORT, EMPTY_SEARCH_CRITERIA, filterPublishedListings, isSameSearch, readSearchCriteria, readSearchPage, readSearchSort, toSearchParams } from './searchCriteria';
import {
  SEARCH_RESULTS_PAGE_SIZE,
  hiddenSearchListings,
  makeSearchPage,
  makeSearchResult,
  noResultSearches,
  paginatedSearchListings,
  searchMatchCases,
  searchMatchListings,
} from '../testing/searchFixtures';

// The listings module is loaded only for its page size. Its Supabase client module reads
// `import.meta`, which Jest cannot parse, so it is replaced.
jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

describe('search criteria in the URL', () => {
  it('reads a trimmed location and keyword, treating a missing one as empty', () => {
    expect(readSearchCriteria(new URLSearchParams('location=%20Chiang%20Mai%20&keyword=garden')))
      .toEqual({ location: 'Chiang Mai', keyword: 'garden', sort: 'newest' });
    expect(readSearchCriteria(new URLSearchParams(''))).toEqual({ location: '', keyword: '', sort: 'newest' });
  });

  it('leaves blank fields out, so an empty search is the plain browse-all URL', () => {
    expect(toSearchParams({ location: '   ', keyword: '', sort: 'newest' }).toString()).toBe('');
    expect(toSearchParams({ location: ' Bangkok ', keyword: '', sort: 'newest' }).toString()).toBe('location=Bangkok');
  });

  it('reads only positive safe-integer page values and defaults invalid values to the first page', () => {
    expect(readSearchPage(new URLSearchParams('page=3'))).toBe(3);
    expect(readSearchPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readSearchPage(new URLSearchParams('page=-2'))).toBe(1);
    expect(readSearchPage(new URLSearchParams('page=2.5'))).toBe(1);
    expect(readSearchPage(new URLSearchParams('page=9007199254740992'))).toBe(1);
    expect(readSearchPage(new URLSearchParams('page=2147483648'))).toBe(2147483647);
    expect(readSearchPage(new URLSearchParams(''))).toBe(1);
  });

  it('stores later pages beside the applied search while omitting the first page', () => {
    const criteria = { location: 'Bangkok', keyword: 'garden', sort: 'newest' as const };
    expect(toSearchParams(criteria).toString()).    toBe('location=Bangkok&keyword=garden');    expect(toSearchParams(criteria, 2).toString()).toBe('location=Bangkok&keyword=garden&page=2');
  });

  it('treats searches that differ only in surrounding spaces as the same search', () => {
    const spaced = { ...EMPTY_SEARCH_CRITERIA, location: 'Bangkok ' };
    const trimmed = { ...EMPTY_SEARCH_CRITERIA, location: 'Bangkok' };
    expect(isSameSearch(spaced, trimmed)).toBe(true);
    expect(isSameSearch({ ...trimmed, keyword: 'cat' }, trimmed)).toBe(false);
  });

  it('matches trimmed location and keyword text without case sensitivity', () => {
    const listings = [
      makeSearchResult({
        id: 'chiang-mai',
        location: 'Chiang Mai, Hang Dong',
        title: 'Quiet Garden Home',
        description: 'A fenced place near the park.',
      }),
      makeSearchResult({
        id: 'bangkok',
        location: 'Bangkok',
        title: 'City studio',
        description: 'A compact indoor space.',
      }),
    ];

    expect(filterPublishedListings(listings, { location: '  CHIANG mai ', keyword: ' GARDEN ' }))
      .toEqual([listings[0]]);
    expect(filterPublishedListings(listings, { location: '', keyword: 'park' }))
      .toEqual([listings[0]]);
  });

  it('treats wildcard and filter punctuation as literal text', () => {
    const listings = [
      makeSearchResult({ id: 'literal', title: '100% safe (indoors)', description: 'Cats welcome.' }),
      makeSearchResult({ id: 'ordinary', title: 'Garden home', description: 'Dogs welcome.' }),
    ];

    expect(filterPublishedListings(listings, { location: '', keyword: '%' }).map(({ id }) => id))
      .toEqual(['literal']);
    expect(filterPublishedListings(listings, { location: '', keyword: '(_)' })).toEqual([]);
  });

  it('defensively excludes unpublished and deleted rows', () => {
    const listings = [
      makeSearchResult({ id: 'published' }),
      makeSearchResult({ id: 'draft', status: 'draft' }),
      makeSearchResult({ id: 'deleted', status: 'deleted', deleted_at: '2026-10-01T00:00:00.000Z' }),
    ];

    expect(filterPublishedListings(listings, { location: '', keyword: '' }).map(({ id }) => id))
      .toEqual(['published']);
  });
});

describe('search fixtures', () => {
  const listings = [...searchMatchListings, ...hiddenSearchListings];
  const ids = (results: readonly { id: string }[]) => results.map(({ id }) => id);

  it.each(searchMatchCases)('finds $name', ({ criteria, expectedIds }) => {
    expect(ids(filterPublishedListings(listings, criteria))).toEqual(expectedIds);
  });

  it.each(noResultSearches)('returns nothing for $name', ({ criteria }) => {
    expect(filterPublishedListings(listings, criteria)).toEqual([]);
  });

  it('browses every published listing and none of the hidden ones', () => {
    expect(ids(filterPublishedListings(listings, EMPTY_SEARCH_CRITERIA))).toEqual(ids(searchMatchListings));
  });
});

describe('sort in the URL', () => {
  it.each(['oldest', 'title', 'capacity'] as const)('reads and writes the %s sort beside the search and page', (sort) => {
    const criteria = { location: 'Bangkok', keyword: 'garden', sort };

    expect(readSearchCriteria(new URLSearchParams(`location=Bangkok&keyword=garden&sort=${sort}`))).toEqual(criteria);
    expect(toSearchParams(criteria, 2).toString()).toBe(`location=Bangkok&keyword=garden&sort=${sort}&page=2`);
  });

  it('defaults a missing or unknown sort to newest and leaves it out of the URL', () => {
    expect(readSearchSort(new URLSearchParams())).toBe(DEFAULT_SEARCH_SORT);
    expect(readSearchSort(new URLSearchParams('sort=price'))).toBe(DEFAULT_SEARCH_SORT);
    expect(toSearchParams({ ...EMPTY_SEARCH_CRITERIA, sort: 'newest' }).toString()).toBe('');
  });

  it('treats a different sort as a different search, and the empty search as the default sort', () => {
    expect(isSameSearch(EMPTY_SEARCH_CRITERIA, { ...EMPTY_SEARCH_CRITERIA, sort: 'title' })).toBe(false);
    expect(EMPTY_SEARCH_CRITERIA.sort).toBe(DEFAULT_SEARCH_SORT);
  });
});

describe('pagination fixtures', () => {
  it('build pages the size the app requests', () => {
    expect(SEARCH_RESULTS_PAGE_SIZE).toBe(PUBLISHED_LISTINGS_PAGE_SIZE);
  });

  it.each([0, -1, 1.5])('refuse page %s, as the search RPC does', (page) => {
    expect(() => makeSearchPage(paginatedSearchListings, page)).toThrow('Page must be a positive integer.');
  });
});
