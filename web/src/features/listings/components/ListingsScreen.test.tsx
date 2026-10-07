/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListingsScreen } from './ListingsScreen';

// Referenced from inside jest.mock below, which babel hoists above these
// declarations: jest only allows out-of-scope references whose name starts
// with "mock", so this state must be named (and reset) accordingly.
const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();
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
    mutateAsync: mockMutateAsync,
    isPending: mockMutationState.isPending,
    isError: mockMutationState.isError,
  }),
  useDeleteListing: () => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: mockMutationState.isPending,
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
  mockDeleteMutateAsync.mockResolvedValue(undefined);
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

  it('requires confirmation before unpublishing a published listing', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Unpublish listing listing-123' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Existing bookings are not changed.');
    expect(mockMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Unpublish$/ }));

    expect(mockMutateAsync).toHaveBeenCalledWith({ listingId: 'listing-123', status: 'draft' });
  });

  it('cancels with Escape and restores focus to the action that opened the dialog', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Unpublish listing listing-123' });

    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('cancels with the Cancel button and restores focus to the delete control', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Delete listing listing-123' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps keyboard focus cycling inside the confirmation dialog', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: /^Delete$/ });

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
  });

  it('soft-deletes only after confirmation and moves focus to the page heading', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('pending or confirmed bookings cannot be deleted');
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('listing-123');
    expect(await screen.findByRole('heading', { name: 'My listings' })).toHaveFocus();
  });

  it('keeps the delete confirmation open and explains active bookings', async () => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockRejectedValueOnce(new Error('Listing has active bookings and cannot be deleted.'));
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This listing has pending or confirmed bookings and cannot be deleted.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

  it('shows an error when publishing a draft fails', async () => {
    const user = userEvent.setup();
    mockListingState.status = 'draft';
    mockMutateAsync.mockRejectedValueOnce(new Error('network failed'));
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Publish listing listing-123' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not publish this listing');
  });

  it('shows a publication error in the confirmation dialog and lets the owner retry', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('network failed'));

    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Unpublish listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Unpublish$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not unpublish this listing');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
