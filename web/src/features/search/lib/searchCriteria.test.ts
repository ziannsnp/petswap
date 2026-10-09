import { isSameSearch, readSearchCriteria, toSearchParams } from './searchCriteria';

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
});
