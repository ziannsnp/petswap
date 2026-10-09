import { useMyListings, useSetListingPublicationStatus } from './useListings';
import { listMyListings } from '../lib/listingApi';
import { useAuth } from '@/features/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options) => options),
  useMutation: jest.fn((options) => options),
  useQueryClient: jest.fn(),
}));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/listingApi', () => ({
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseMutation = jest.mocked(useMutation);
const mockedUseQueryClient = jest.mocked(useQueryClient);

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

describe('useSetListingPublicationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries } as never);
  });

  it('refreshes public, owner, and detail listing caches after a successful change', () => {
    useSetListingPublicationStatus();
    const mutationOptions = mockedUseMutation.mock.calls[0][0];

    mutationOptions.onSuccess?.(undefined as never, undefined as never, undefined as never, undefined as never);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['listings'] });
  });
});
