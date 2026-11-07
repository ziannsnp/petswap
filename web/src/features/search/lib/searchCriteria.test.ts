import { PUBLISHED_LISTINGS_PAGE_SIZE } from '@/features/listings';
import { DEFAULT_SEARCH_SORT, EMPTY_SEARCH_CRITERIA, filterPublishedListings, findSearchDateError, findTidiedSearchParams, isSameSearch, readSearchCriteria, readSearchFilters, readSearchPage, readSearchSort, toSearchFilterDraft, toSearchParams } from './searchCriteria';
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
      .toEqual({ ...EMPTY_SEARCH_CRITERIA, location: 'Chiang Mai', keyword: 'garden' });
    expect(readSearchCriteria(new URLSearchParams(''))).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it('leaves blank fields out, so an empty search is the plain browse-all URL', () => {
    expect(toSearchParams({ ...EMPTY_SEARCH_CRITERIA, location: '   ' }).toString()).toBe('');
    expect(toSearchParams({ ...EMPTY_SEARCH_CRITERIA, location: ' Bangkok ' }).toString()).toBe('location=Bangkok');
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
    const criteria = { ...EMPTY_SEARCH_CRITERIA, location: 'Bangkok', keyword: 'garden' };
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
    const criteria = { ...EMPTY_SEARCH_CRITERIA, location: 'Bangkok', keyword: 'garden', sort };

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

describe('filters in the URL', () => {
  const filtered = {
    ...EMPTY_SEARCH_CRITERIA,
    location: 'Bangkok',
    petType: 'guinea_pig' as const,
    minCapacity: 3,
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    sort: 'title' as const,
  };
  const filteredUrl = 'location=Bangkok&petType=guinea_pig&minCapacity=3&startDate=2026-12-01&endDate=2026-12-05&sort=title';

  it('reads and writes every filter beside the search, the sort, and the page', () => {
    expect(readSearchCriteria(new URLSearchParams(filteredUrl))).toEqual(filtered);
    expect(toSearchParams(filtered).toString()).toBe(filteredUrl);
    expect(toSearchParams(filtered, 2).toString()).toBe(`${filteredUrl}&page=2`);
  });

  it('treats a different filter as a different search', () => {
    expect(isSameSearch(filtered, { ...filtered })).toBe(true);
    expect(isSameSearch(filtered, { ...filtered, petType: 'cat' })).toBe(false);
    expect(isSameSearch(filtered, { ...filtered, minCapacity: null })).toBe(false);
    expect(isSameSearch(filtered, { ...filtered, endDate: '2026-12-06' })).toBe(false);
  });

  it.each([
    ['an unknown pet type', 'petType=dragon'],
    ['a blank pet type', 'petType='],
    ['a capacity every listing meets', 'minCapacity=1'],
    ['a capacity beyond the options', 'minCapacity=11'],
    ['a fractional capacity', 'minCapacity=2.5'],
    ['a capacity that is not a number', 'minCapacity=many'],
    ['a start date alone', 'startDate=2026-12-01'],
    ['an end date alone', 'endDate=2026-12-05'],
    ['a range that ends before it starts', 'startDate=2026-12-05&endDate=2026-12-01'],
    ['a range that ends on its start', 'startDate=2026-12-05&endDate=2026-12-05'],
    ['a day that does not exist', 'startDate=2026-02-31&endDate=2026-03-02'],
    ['a date in another format', 'startDate=12/01/2026&endDate=12/05/2026'],
  ])('treats %s as no filter', (_name, query) => {
    expect(readSearchCriteria(new URLSearchParams(query))).toEqual(EMPTY_SEARCH_CRITERIA);
  });

  it('turns the control values back into the same filters', () => {
    const { petType, minCapacity, startDate, endDate } = filtered;
    const filters = { petType, minCapacity, startDate, endDate };
    const empty = { petType: null, minCapacity: null, startDate: null, endDate: null };

    expect(readSearchFilters(new URLSearchParams(toSearchFilterDraft(filters)))).toEqual(filters);
    expect(toSearchFilterDraft(empty)).toEqual({ petType: '', minCapacity: '', startDate: '', endDate: '' });
    expect(readSearchFilters(new URLSearchParams(toSearchFilterDraft(empty)))).toEqual(empty);
  });
});

describe('date range validation', () => {
  const bothDates = 'Choose both a start date and an end date.';
  const endAfterStart = 'End date must be later than the start date.';

  it.each([
    ['no dates at all', '', '', null],
    ['a one-night range', '2026-12-01', '2026-12-02', null],
    ['a range across a new year', '2026-12-31', '2027-01-01', null],
    ['an end date alone', '', '2026-12-05', { field: 'startDate', message: bothDates }],
    ['a start date alone', '2026-12-01', '', { field: 'endDate', message: bothDates }],
    ['an end before the start', '2026-12-05', '2026-12-01', { field: 'endDate', message: endAfterStart }],
    ['an end on the start', '2026-12-05', '2026-12-05', { field: 'endDate', message: endAfterStart }],
    ['a start that does not exist', '2026-02-31', '2026-03-02', { field: 'startDate', message: 'Enter a valid start date.' }],
    ['an end that does not exist', '2026-04-01', '2026-04-31', { field: 'endDate', message: 'Enter a valid end date.' }],
  ])('gives the right answer for %s', (_name, startDate, endDate, expected) => {
    expect(findSearchDateError(startDate, endDate)).toEqual(expected);
  });
});

describe('tidying the URL', () => {
  const filteredUrl = 'petType=cat&minCapacity=3&startDate=2026-12-01&endDate=2026-12-05&sort=title';

  it('leaves a URL alone when it says what is applied', () => {
    expect(findTidiedSearchParams(new URLSearchParams(filteredUrl), 1)).toBeNull();
    expect(findTidiedSearchParams(new URLSearchParams(`${filteredUrl}&page=2`), 2)).toBeNull();
  });

  it('leaves blank or padded text for the next submit', () => {
    expect(findTidiedSearchParams(new URLSearchParams('location=%20Bangkok&keyword='), 1)).toBeNull();
  });

  it.each([
    ['an invalid filter', 'keyword=cat&petType=dragon', 1, 'keyword=cat'],
    ['an invalid range', 'startDate=2026-12-05&endDate=2026-12-01&minCapacity=3', 1, 'minCapacity=3'],
    ['half a range', 'endDate=2026-12-05&petType=cat', 1, 'petType=cat'],
    ['the default sort', 'sort=newest&petType=cat', 1, 'petType=cat'],
    ['an explicit first page', 'petType=cat&page=1', 1, 'petType=cat'],
    ['a page past the end', 'petType=cat&page=9', 2, 'petType=cat&page=2'],
  ])('replaces %s and keeps the rest', (_name, query, resolvedPage, expected) => {
    expect(findTidiedSearchParams(new URLSearchParams(query), resolvedPage)?.toString()).toBe(expected);
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
