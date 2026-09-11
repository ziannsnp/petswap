/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ListingDetailScreen } from './ListingDetailScreen';

let viewerId: string | undefined;

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ user: viewerId ? { id: viewerId } : null }),
}));

const listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  title: 'Quiet home',
  location: 'Chiang Mai',
  description: 'A calm place for pets.',
  capacity: 2,
  accepted_pet_types: ['dog', 'cat'],
  facilities: 'Lawn\nEnclosed fence',
  status: 'published',
  deleted_at: null,
  published_at: '2026-09-10T00:00:01.000Z',
  created_at: '2026-09-10T00:00:00.000Z',
  updated_at: '2026-09-10T00:00:00.000Z',
  cover_photo_url: 'https://example.test/front.jpg',
  listing_images: [
    {
      id: 'image-1',
      listing_id: 'listing-1',
      storage_path: 'listing-1/front.jpg',
      alt_text: null,
      sort_order: 0,
      created_at: '2026-09-10T00:00:00.000Z',
      signed_url: 'https://example.test/front.jpg',
    },
    {
      id: 'image-2',
      listing_id: 'listing-1',
      storage_path: 'listing-1/room.jpg',
      alt_text: 'Indoor play room',
      sort_order: 1,
      created_at: '2026-09-10T00:00:00.000Z',
      signed_url: 'https://example.test/room.jpg',
    },
  ],
  host: {
    id: 'owner-1',
    display_name: 'Nina Host',
    photo_url: null,
    location: 'Hang Dong',
  },
};

jest.mock('../hooks/useListings', () => ({
  useListing: () => ({ data: listing, isPending: false, isError: false }),
}));

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/listings/listing-1']}>
      <Routes>
        <Route path="/listings/:listingId" element={<ListingDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ListingDetailScreen', () => {
  beforeEach(() => {
    viewerId = undefined;
  });

  it('shows public visitors the host, selected facilities, and every photo', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: /back to listings/i })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Host profile' })).toHaveTextContent('Nina Host');
    expect(screen.getByRole('list')).toHaveTextContent('Lawn');
    expect(screen.getByRole('list')).toHaveTextContent('Enclosed fence');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Quiet home photo 1' })).toHaveAttribute(
      'src',
      'https://example.test/front.jpg',
    );
    expect(screen.getByRole('img', { name: 'Indoor play room' })).toBeInTheDocument();
  });

  it('shows the owner the listing status and owner navigation', () => {
    viewerId = 'owner-1';
    renderScreen();

    expect(screen.getByRole('link', { name: /back to my listings/i })).toHaveAttribute('href', '/listings');
    expect(screen.getByText('Published')).toBeInTheDocument();
  });
});
