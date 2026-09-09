import { listingKeys } from './useListings';

jest.mock('../lib/listingApi', () => ({
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
}));

describe('listingKeys', () => {
  it('keeps each owner\'s My Listings cache separate', () => {
    expect(listingKeys.mine('owner-a')).toEqual(['listings', 'mine', 'owner-a']);
    expect(listingKeys.mine('owner-b')).toEqual(['listings', 'mine', 'owner-b']);
    expect(listingKeys.mine('owner-a')).not.toEqual(listingKeys.mine('owner-b'));
  });
});
