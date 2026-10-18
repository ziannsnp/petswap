import { networkFailures } from '../testing/listingFixtures';
import { ListingError, listingErrorCode, toListingError } from './listingErrors';

describe('listing error contract', () => {
  it.each([
    [{ code: '401', message: 'authentication required' }, 'unauthorized'],
    [{ code: '42501', message: 'permission denied' }, 'forbidden'],
    [{ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 'not_found'],
    [{ code: 'P0001', message: 'Listing is already deleted.' }, 'deleted'],
    [{ message: 'listing has an active booking' }, 'active_booking'],
  ] as const)('maps a backend error to %s', (error, expectedCode) => {
    expect(listingErrorCode(error)).toBe(expectedCode);
  });

  it('preserves an existing listing error', () => {
    const error = new ListingError('deleted', 'Deleted');
    expect(toListingError(error)).toBe(error);
  });

  it.each([
    ['a PostgREST call', networkFailures.postgrest],
    ['an auth call', networkFailures.auth],
    ['a timed-out PostgREST call', { code: '', message: 'AbortError: The operation was aborted.' }],
  ])('recognises %s that could not reach Supabase as a network failure', (_, error) => {
    expect(toListingError(error)).toMatchObject({ code: 'network', message: 'The listing service could not be reached.' });
  });

  it('maps browser network failures without exposing their message', () => {
    const error = toListingError(new TypeError('Failed to fetch https://private.example'));
    expect(error).toMatchObject({ code: 'network', message: 'The listing service could not be reached.' });
  });
});
