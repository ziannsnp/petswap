/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListingsScreen } from './ListingsScreen';

// Referenced from inside jest.mock below, which babel hoists above these
// declarations: jest only allows out-of-scope references whose name starts
// with "mock", so this state must be named (and reset) accordingly.
const mockMutate = jest.fn();
const mockMutationState = { isPending: false, isError: false };
const mockListingState = { status: 'published' as 'draft' | 'published' };

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
      status: mockListingState.status,
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
  useSetListingPublicationStatus: () => ({
    mutate: mockMutate,
    isPending: mockMutationState.isPending,
    isError: mockMutationState.isError,
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockMutationState.isPending = false;
  mockMutationState.isError = false;
  mockListingState.status = 'published';
});

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

  it('lets an owner unpublish a published listing to stop new booking requests', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Unpublish listing listing-123' }));

    expect(mockMutate).toHaveBeenCalledWith({ listingId: 'listing-123', status: 'draft' });
  });

  it('offers to republish a draft listing', () => {
    mockListingState.status = 'draft';

    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Publish listing listing-123' })).toBeInTheDocument();
  });

  it('shows an error when the publication toggle fails', () => {
    mockMutationState.isError = true;

    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('We could not unpublish this listing');
  });
});
