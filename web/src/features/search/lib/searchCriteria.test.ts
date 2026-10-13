import { filterPublishedListings, isSameSearch, readSearchCriteria, toSearchParams } from './searchCriteria';
import { makeSearchResult } from '../testing/searchFixtures';

describe('search criteria in the URL', () => {
  it('reads a trimmed location and keyword, treating a missing one as empty', () => {
    expect(readSearchCriteria(new URLSearchParams('location=%20Chiang%20Mai%20&keyword=garden')))
      .toEqual({ location: 'Chiang Mai', keyword: 'garden' });
    expect(readSearchCriteria(new URLSearchParams(''))).toEqual({ location: '', keyword: '' });
  });

  it('leaves blank fields out, so an empty search is the plain browse-all URL', () => {
    expect(toSearchParams({ location: '   ', keyword: '' }).toString()).toBe('');
    expect(toSearchParams({ location: ' Bangkok ', keyword: '' }).toString()).toBe('location=Bangkok');
  });

  it('treats searches that differ only in surrounding spaces as the same search', () => {
    expect(isSameSearch({ location: 'Bangkok ', keyword: '' }, { location: 'Bangkok', keyword: '' })).toBe(true);
    expect(isSameSearch({ location: 'Bangkok', keyword: 'cat' }, { location: 'Bangkok', keyword: '' })).toBe(false);
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
