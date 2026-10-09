/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useListing } from '../hooks/useListings';
import { ListingError } from '../lib/listingErrors';
import type { Listing } from '../lib/listingApi';
import { ListingDetailScreen } from './ListingDetailScreen';

jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/features/bookings', () => ({
  RequestBookingForm: ({ listingId }: { listingId: string }) => <div>Booking form for {listingId}</div>,
}));
jest.mock('../hooks/useListings', () => ({ useListing: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseListing = jest.mocked(useListing);
const refetch = jest.fn();

const publishedListing: Listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  title: 'Quiet home near the park',
  location: 'Chiang Mai, Hang Dong',
  description: 'A calm, fenced home with plenty of indoor space.',
  capacity: 2,
  accepted_pet_types: ['dog', 'cat'],
  facilities: 'Enclosed fence\nAir-conditioned room',
  status: 'published',
  deleted_at: null,
  published_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  listing_images: [],
  cover_photo_url: null,
  host: {
    id: 'owner-1',
    display_name: 'Alex Rivera',
    photo_url: null,
    location: 'Chiang Mai',
  },
};

function listingQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: publishedListing,
    isPending: false,
    isError: false,
    error: null,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useListing>;
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/listings/listing-1']}>
      <Routes>
        <Route path="/listings/:listingId" element={<ListingDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
  mockedUseListing.mockReturnValue(listingQuery());
});

describe('ListingDetailScreen', () => {
  it('renders the complete published listing details and host contract', () => {
    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: publishedListing.title })).toBeInTheDocument();
    expect(screen.getByText(publishedListing.location)).toBeInTheDocument();
    expect(screen.getByText(publishedListing.description)).toBeInTheDocument();
    expect(screen.getByText('Up to 2 pets')).toBeInTheDocument();
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Cat')).toBeInTheDocument();
    expect(screen.getByText('Enclosed fence')).toBeInTheDocument();
    expect(screen.getByText('Air-conditioned room')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('Based in Chiang Mai')).toBeInTheDocument();
    expect(screen.getByText('Booking form for listing-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to listings' })).toHaveAttribute('href', '/');
  });

  it('falls back to host initials when the profile photo fails to load', () => {
    mockedUseListing.mockReturnValue(listingQuery({
      data: {
        ...publishedListing,
        host: { ...publishedListing.host!, photo_url: 'https://example.test/avatar.jpg' },
      },
    }));

    renderDetail();
    fireEvent.error(screen.getByRole('img', { name: "Alex Rivera's profile" }));

    expect(screen.queryByRole('img', { name: "Alex Rivera's profile" })).not.toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
  });

  it('labels a private owner preview and links back to My Listings', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'owner-1' } } as ReturnType<typeof useAuth>);
    mockedUseListing.mockReturnValue(listingQuery({ data: { ...publishedListing, status: 'draft' } }));

    renderDetail();

    expect(screen.getByRole('status')).toHaveTextContent('Owner preview');
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to my listings' })).toHaveAttribute('href', '/listings');
  });

  it('uses the same safe response for missing, forbidden, and deleted listings', () => {
    mockedUseListing.mockReturnValue(listingQuery({
      data: undefined,
      isError: true,
      error: new ListingError('deleted', 'internal deleted detail'),
    }));

    renderDetail();

    expect(screen.getByRole('alert')).toHaveTextContent('Listing unavailable');
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal deleted detail');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('offers retry for a network failure', async () => {
    const user = userEvent.setup();
    mockedUseListing.mockReturnValue(listingQuery({
      data: undefined,
      isError: true,
      error: new ListingError('network', 'offline'),
    }));

    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
