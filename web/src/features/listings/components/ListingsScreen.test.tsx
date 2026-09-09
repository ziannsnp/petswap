/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useMyListings } from '../hooks/useListings';
import { ListingsScreen } from './ListingsScreen';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useListings', () => ({ useMyListings: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseMyListings = jest.mocked(useMyListings);

describe('ListingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { id: 'owner-123' } } as ReturnType<typeof useAuth>);
    mockedUseMyListings.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useMyListings>);
  });

  it('loads My Listings for the authenticated owner', () => {
    render(
      <MemoryRouter>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(mockedUseMyListings).toHaveBeenCalledWith('owner-123');
    expect(screen.getByRole('heading', { name: 'My listings' })).toBeInTheDocument();
    expect(screen.getByText('No listings yet')).toBeInTheDocument();
  });
});
