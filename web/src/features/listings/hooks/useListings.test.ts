import { useMyListings } from './useListings';
import { listMyListings } from '../lib/listingApi';
import { useAuth } from '@/features/auth';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn((options) => options) }));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/listingApi', () => ({
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);

describe('useMyListings', () => {
  it('scopes the cache key to the authenticated owner', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'owner-123' },
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    expect(useMyListings()).toEqual({
      queryKey: ['listings', 'mine', 'owner-123'],
      queryFn: listMyListings,
      enabled: true,
    });
  });

  it('does not query private listings before authentication resolves', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    expect(useMyListings()).toEqual({
      queryKey: ['listings', 'mine', 'anonymous'],
      queryFn: listMyListings,
      enabled: false,
    });
  });
});
