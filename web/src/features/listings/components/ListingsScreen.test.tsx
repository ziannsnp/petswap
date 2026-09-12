/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingsScreen } from './ListingsScreen';

jest.mock('../hooks/useListings', () => ({
  useMyListings: () => ({
    data: [{
      id: 'listing-123',
      title: 'Quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      accepted_pet_types: ['dog'],
      facilities: null,
      status: 'published',
      deleted_at: null,
      published_at: '2026-09-10T00:00:01.000Z',
      owner_id: 'owner-123',
      created_at: '2026-09-10T00:00:00.000Z',
      updated_at: '2026-09-10T00:00:00.000Z',
      listing_images: [],
      cover_photo_url: null,
    }],
    isPending: false,
    isError: false,
  }),
}));

describe('ListingsScreen', () => {
  it('confirms that a newly published listing is discoverable', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/listings', state: { listingSaved: 'published' } }]}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Listing published successfully. Pet owners can now discover it.',
    );
    expect(screen.getByRole('link', { name: /quiet home/i })).toHaveAttribute('href', '/listings/listing-123');
  });

  it('confirms that a draft remains private', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/listings', state: { listingSaved: 'draft' } }]}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Draft saved successfully. Only you can view it until you publish it.',
    );
  });
});
