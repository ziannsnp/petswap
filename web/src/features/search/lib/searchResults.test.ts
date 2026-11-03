import {
  changeQuery, changeSort, DEFAULT_CRITERIA, getResultsPage, paginate, parsePage, parseSort, resetCriteria,
} from './searchResults';

const make = (n: number) => ({
  title: `Sitter ${String(n).padStart(2, '0')}`,
  location: n % 2 ? 'Bangkok' : 'Chiang Mai',
  description: 'Cozy home',
  capacity: n % 4,
  published_at: `2026-01-${String(n).padStart(2, '0')}T00:00:00Z`,
});
const listings = Array.from({ length: 14 }, (_, i) => make(i + 1));

describe('search results', () => {
  it('sorts newest first by default and oldest on request', () => {
    expect(getResultsPage(listings, DEFAULT_CRITERIA).items[0].title).toBe('Sitter 14');
    expect(getResultsPage(listings, { ...DEFAULT_CRITERIA, sort: 'oldest' }).items[0].title).toBe('Sitter 01');
  });

  it('sorts by title and by capacity descending', () => {
    expect(getResultsPage(listings, { ...DEFAULT_CRITERIA, sort: 'title' }).items[0].title).toBe('Sitter 01');
    expect(getResultsPage(listings, { ...DEFAULT_CRITERIA, sort: 'capacity' }).items[0].capacity).toBe(3);
  });

  it('keeps the search query applied while sorting and paginating', () => {
    const page = getResultsPage(listings, { query: 'bangkok', sort: 'title', page: 2 });
    expect(page.totalItems).toBe(7);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].title).toBe('Sitter 13');
  });

  it('paginates across the sorted set and clamps out-of-range pages', () => {
    expect(paginate(listings, 1).totalPages).toBe(3);
    expect(getResultsPage(listings, { ...DEFAULT_CRITERIA, page: 99 }).page).toBe(3);
    expect(getResultsPage([], DEFAULT_CRITERIA)).toMatchObject({ items: [], page: 1, totalPages: 1 });
  });

  it('returns to page 1 when sort or query changes, preserving other criteria', () => {
    const base = { query: 'bangkok', sort: 'title' as const, page: 3 };
    expect(changeSort(base, 'oldest')).toEqual({ query: 'bangkok', sort: 'oldest', page: 1 });
    expect(changeQuery(base, 'chiang')).toEqual({ query: 'chiang', sort: 'title', page: 1 });
  });

  it('reset restores the default criteria and lists all listings', () => {
    expect(resetCriteria()).toEqual(DEFAULT_CRITERIA);
    expect(getResultsPage(listings, resetCriteria()).totalItems).toBe(14);
  });

  it('falls back to defaults for invalid URL values', () => {
    expect(parseSort('bogus')).toBe('newest');
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('4')).toBe(4);
  });
});
