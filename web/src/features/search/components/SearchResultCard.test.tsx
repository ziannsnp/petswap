/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Listing } from '@/features/listings';
import { makeSearchResult } from '../testing/searchFixtures';
import { SearchResultCard } from './SearchResultCard';

jest.mock('@/features/listings', () => ({
  petSpeciesLabel: jest.requireActual('@/features/listings/lib/listingOptions').petSpeciesLabel,
}));

const mainPhoto = {
  id: 'img-1',
  listing_id: 'listing-1',
  storage_path: 'listing-1/garden.jpg',
  alt_text: 'Lawn behind the house',
  sort_order: 0,
  created_at: '2026-10-01T00:00:00.000Z',
  signed_url: 'https://storage.test/signed/garden.jpg',
};
const secondPhoto = {
  ...mainPhoto,
  id: 'img-2',
  storage_path: 'listing-1/room.jpg',
  alt_text: 'Guest room',
  sort_order: 1,
  signed_url: 'https://storage.test/signed/room.jpg',
};

function renderCard(listing: Listing) {
  render(
    <MemoryRouter>
      <SearchResultCard listing={listing} />
    </MemoryRouter>,
  );
}

describe('SearchResultCard', () => {
  it('shows the main photo, title, location, accepted pets, and capacity', () => {
    renderCard(makeSearchResult({
      listing_images: [mainPhoto, secondPhoto],
      cover_photo_url: mainPhoto.signed_url,
      accepted_pet_types: ['dog', 'guinea_pig'],
      capacity: 3,
    }));

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Lawn behind the house' })).toHaveAttribute('src', mainPhoto.signed_url);
    expect(screen.getByRole('heading', { name: 'Sunny garden room' })).toBeInTheDocument();
    expect(screen.getByText('Chiang Mai, Hang Dong')).toBeInTheDocument();
    const pets = within(screen.getByRole('list', { name: 'Pets accepted' })).getAllByRole('listitem');
    expect(pets.map((item) => item.textContent)).toEqual(['Dog', 'Guinea pig', 'Up to 3 pets']);
  });

  it('links the card to the listing detail page by its title', () => {
    renderCard(makeSearchResult({ id: 'listing-42' }));

    expect(screen.getByRole('link', { name: 'Sunny garden room' })).toHaveAttribute('href', '/listings/listing-42');
  });

  it('shows a placeholder when the listing has no photo', () => {
    renderCard(makeSearchResult());

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('No photo yet')).toBeInTheDocument();
  });

  it('swaps a photo that fails to load for a placeholder and keeps the rest of the card', () => {
    renderCard(makeSearchResult({
      listing_images: [{ ...mainPhoto, alt_text: null }],
      cover_photo_url: mainPhoto.signed_url,
    }));

    fireEvent.error(screen.getByRole('img', { name: 'Sunny garden room' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sunny garden room' })).toBeInTheDocument();
  });

  it('uses the singular for a capacity of one pet', () => {
    renderCard(makeSearchResult({ capacity: 1 }));

    expect(screen.getByText('Up to 1 pet')).toBeInTheDocument();
  });
});
