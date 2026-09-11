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
      status: 'draft',
      deleted_at: null,
      published_at: null,
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
  it('confirms that a newly created draft listing was saved', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/listings', state: { listingSaved: true } }]}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Draft listing saved successfully. You can preview it from My listings.',
    );
    expect(screen.getByRole('link', { name: /quiet home/i })).toHaveAttribute('href', '/listings/listing-123');
  });
});