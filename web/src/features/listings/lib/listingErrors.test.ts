import { ListingError, listingErrorCode, toListingError } from './listingErrors';

describe('listing error contract', () => {
  it.each([
    [{ code: '42501', message: 'permission denied' }, 'forbidden'],
    [{ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 'not_found'],
    [{ message: 'listing has an active booking' }, 'active_booking'],
  ] as const)('maps a backend error to %s', (error, expectedCode) => {
    expect(listingErrorCode(error)).toBe(expectedCode);
  });

  it('preserves an existing listing error', () => {
    const error = new ListingError('deleted', 'Deleted');
    expect(toListingError(error)).toBe(error);
  });

  it('maps browser network failures without exposing their message', () => {
    const error = toListingError(new TypeError('Failed to fetch https://private.example'));
    expect(error).toMatchObject({ code: 'network', message: 'The listing service could not be reached.' });
  });
});
