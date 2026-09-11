import { useMyListings } from './useListings';
import { listMyListings } from '../lib/listingApi';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn((options) => options) }));
jest.mock('../lib/listingApi', () => ({
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
}));

describe('useMyListings', () => {
  it('uses a stable cache key for the authenticated owner query', () => {
    expect(useMyListings()).toEqual({
      queryKey: ['listings', 'mine'],
      queryFn: listMyListings,
    });
  });
});
