/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { useListing } from '../hooks/useListings';
import { ListingError } from '../lib/listingErrors';
import type { Listing } from '../lib/listingApi';
import {
  LISTING_OWNER_ID,
  detailContentListings,
  detailUnavailableErrors,
  detailVisibilityListings,
  listingFacilities,
  listingHosts,
} from '../testing/listingFixtures';
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

  it('omits the host section while the host projection is unavailable', () => {
    mockedUseListing.mockReturnValue(listingQuery({
      data: { ...publishedListing, host: null },
    }));

    renderDetail();

    expect(screen.queryByRole('heading', { name: 'Your host' })).not.toBeInTheDocument();
    expect(screen.queryByText('Host details unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('The host profile could not be loaded.')).not.toBeInTheDocument();
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

describe('ListingDetailScreen visibility', () => {
  it.each([
    {
      viewer: 'a visitor',
      user: null,
      listing: detailVisibilityListings.published,
      badge: null,
      preview: false,
      backLink: 'Back to listings',
    },
    {
      viewer: 'its owner',
      user: { id: LISTING_OWNER_ID },
      listing: detailVisibilityListings.published,
      badge: 'Published',
      preview: false,
      backLink: 'Back to my listings',
    },
    {
      viewer: 'its owner',
      user: { id: LISTING_OWNER_ID },
      listing: detailVisibilityListings.draft,
      badge: 'Draft',
      preview: true,
      backLink: 'Back to my listings',
    },
  ])('shows a $listing.status listing to $viewer', ({ user, listing, badge, preview, backLink }) => {
    mockedUseAuth.mockReturnValue({ user } as ReturnType<typeof useAuth>);
    mockedUseListing.mockReturnValue(listingQuery({ data: listing }));

    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: listing.title })).toBeInTheDocument();
    expect(screen.queryByText(/^(Published|Draft)$/)?.textContent ?? null).toBe(badge);
    expect(Boolean(screen.queryByText(/^Owner preview/))).toBe(preview);
    expect(screen.getByRole('link', { name: backLink })).toBeInTheDocument();
  });

  it.each([
    ['a missing listing', detailUnavailableErrors.missing],
    ["someone else's draft", detailUnavailableErrors.otherUsersDraft],
    ['a deleted listing', detailUnavailableErrors.deleted],
  ])('gives %s the same safe response', (_case, error) => {
    mockedUseListing.mockReturnValue(listingQuery({ data: undefined, isError: true, error }));

    renderDetail();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Listing unavailable');
    expect(alert).not.toHaveTextContent(error.message);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('ListingDetailScreen content', () => {
  it('shows every facility, the host photo, and the whole gallery of a complete listing', () => {
    const listing = detailContentListings.complete;
    mockedUseListing.mockReturnValue(listingQuery({ data: listing }));

    renderDetail();

    const facilities = within(screen.getByRole('region', { name: 'Facilities' })).getAllByRole('listitem');
    expect(facilities.map((item) => item.textContent)).toEqual(['Lawn', 'Enclosed fence', 'Daily photo updates']);
    expect(screen.getByRole('img', { name: "Alex Rivera's profile" })).toHaveAttribute('src', listingHosts.withPhoto.photo_url);
    expect(screen.getByRole('img', { name: 'Fenced garden' })).toHaveAttribute('src', listing.listing_images[0].signed_url);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('keeps a listing with no facilities, photos, or host readable', () => {
    const listing = detailContentListings.bare;
    mockedUseListing.mockReturnValue(listingQuery({ data: listing }));

    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: listing.title })).toBeInTheDocument();
    expect(screen.getByText('No facilities have been added.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: `${listing.title} photo unavailable` })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your host' })).not.toBeInTheDocument();
  });

  it('keeps the details and host when no photo could be signed', () => {
    const listing = detailContentListings.photosUnavailable;
    mockedUseListing.mockReturnValue(listingQuery({ data: listing }));

    renderDetail();

    expect(screen.getByRole('img', { name: `${listing.title} photo unavailable` })).toBeInTheDocument();
    expect(screen.getByText(listing.description)).toBeInTheDocument();
    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.getByText('Based in Chiang Mai')).toBeInTheDocument();
  });

  it('leaves out the host location when the host has not set one', () => {
    mockedUseListing.mockReturnValue(listingQuery({
      data: { ...detailContentListings.bare, host: listingHosts.withoutLocation },
    }));

    renderDetail();

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.queryByText(/^Based in/)).not.toBeInTheDocument();
  });

  it('ignores padding and blank lines in stored facilities', () => {
    mockedUseListing.mockReturnValue(listingQuery({
      data: { ...detailVisibilityListings.published, facilities: listingFacilities.withBlankLines },
    }));

    renderDetail();

    const facilities = within(screen.getByRole('region', { name: 'Facilities' })).getAllByRole('listitem');
    expect(facilities.map((item) => item.textContent)).toEqual(['Lawn', 'Security cameras']);
  });
});
