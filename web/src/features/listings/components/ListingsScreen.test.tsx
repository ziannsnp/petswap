/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useMyListings } from '../hooks/useListings';
import { makeListingRow } from '../testing/listingFixtures';
import { ListingsScreen } from './ListingsScreen';

jest.mock('../hooks/useListings', () => ({ useMyListings: jest.fn() }));

const mockedUseMyListings = jest.mocked(useMyListings);

describe('ListingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads My Listings through the authenticated-owner query', () => {
    mockedUseMyListings.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useMyListings>);

    render(
      <MemoryRouter>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(mockedUseMyListings).toHaveBeenCalledWith();
    expect(screen.getByRole('heading', { name: 'My listings' })).toBeInTheDocument();
    expect(screen.getByText('No listings yet')).toBeInTheDocument();
  });

  it('shows active owner listings and omits soft-deleted rows', () => {
    mockedUseMyListings.mockReturnValue({
      data: [
        { ...makeListingRow({ id: 'listing-live', title: 'Sunny garden room' }), cover_photo_url: null },
        { ...makeListingRow({ id: 'listing-deleted', title: 'Retired listing', status: 'deleted' }), cover_photo_url: null },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useMyListings>);

    render(
      <MemoryRouter>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sunny garden room')).toBeInTheDocument();
    expect(screen.queryByText('Retired listing')).not.toBeInTheDocument();
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Cat')).toBeInTheDocument();
  });
});
