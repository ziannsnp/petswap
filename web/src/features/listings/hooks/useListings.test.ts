import { useDeleteListing, useMyListings, useSetListingPublicationStatus } from './useListings';
import { deleteListing, listMyListings, setListingPublicationStatus } from '../lib/listingApi';
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
  deleteListing: jest.fn(),
  listMyListings: jest.fn(),
  listPublishedListings: jest.fn(),
  setListingPublicationStatus: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseMutation = jest.mocked(useMutation);
const mockedUseQueryClient = jest.mocked(useQueryClient);
const mockedDeleteListing = jest.mocked(deleteListing);
const mockedSetListingPublicationStatus = jest.mocked(setListingPublicationStatus);

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

  it('passes the requested publication status and listing id to the API', async () => {
    mockedSetListingPublicationStatus.mockResolvedValue(undefined as never);
    useSetListingPublicationStatus();
    const mutationOptions = mockedUseMutation.mock.calls[0][0];

    await mutationOptions.mutationFn!({ listingId: 'listing-123', status: 'draft' }, {} as never);

    expect(mockedSetListingPublicationStatus).toHaveBeenCalledWith('listing-123', 'draft');
  });
});

describe('useDeleteListing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries } as never);
  });

  it('refreshes public, owner, and detail listing caches after a successful deletion', () => {
    useDeleteListing();
    const mutationOptions = mockedUseMutation.mock.calls[0][0];

    mutationOptions.onSuccess?.(undefined as never, undefined as never, undefined as never, undefined as never);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['listings'] });
  });

  it('passes the selected listing id to the delete API', async () => {
    mockedDeleteListing.mockResolvedValue(undefined);
    useDeleteListing();
    const mutationOptions = mockedUseMutation.mock.calls[0][0];

    await mutationOptions.mutationFn!('listing-123', {} as never);

    expect(mockedDeleteListing).toHaveBeenCalledWith('listing-123');
  });
});
