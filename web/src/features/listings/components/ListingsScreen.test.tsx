/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ListingError } from '../lib/listingErrors';
import { networkFailures } from '../testing/listingFixtures';
import { ListingsScreen } from './ListingsScreen';

// Referenced from inside jest.mock below, which babel hoists above these
// declarations: jest only allows out-of-scope references whose name starts
// with "mock", so this state must be named (and reset) accordingly.
const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();
const mockMutationState = {
  isPending: false,
  isError: false,
  variables: undefined as { listingId: string; status: 'draft' | 'published' } | undefined,
};
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
    variables: mockMutationState.variables,
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
  mockMutationState.variables = undefined;
  mockListingState.status = 'published';
});

function renderListings() {
  return render(
    <MemoryRouter initialEntries={['/listings']}>
      <ListingsScreen />
    </MemoryRouter>,
  );
}

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

  it.each([
    ['unpublish', 'Unpublish', '"Quiet home" is now unpublished. It no longer appears in search, and existing bookings are unchanged.'],
    ['delete', 'Delete', '"Quiet home" was deleted. It no longer appears in search or in your listings.'],
  ])('confirms a successful %s by the listing name', async (_, action, confirmation) => {
    const user = userEvent.setup();
    renderListings();

    await user.click(screen.getByRole('button', { name: `${action} listing listing-123` }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${action}$`) }));

    expect(await screen.findByRole('status')).toHaveTextContent(confirmation);
  });

  it('confirms that a published draft is back in search', async () => {
    const user = userEvent.setup();
    mockListingState.status = 'draft';
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Publish listing listing-123' }));

    expect(await screen.findByRole('status')).toHaveTextContent('"Quiet home" is now published. Pet owners can find it in search.');
  });

  it('clears the last confirmation when the next action starts', async () => {
    const user = userEvent.setup();
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Unpublish listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Unpublish$/ }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['Unpublish', 'Unpublishing...'],
    ['Delete', 'Deleting...'],
  ])('says what is happening while a confirmed %s runs', async (action, pendingLabel) => {
    const user = userEvent.setup();
    mockMutateAsync.mockReturnValue(new Promise(() => {}));
    mockDeleteMutateAsync.mockReturnValue(new Promise(() => {}));
    const view = renderListings();

    await user.click(screen.getByRole('button', { name: `${action} listing listing-123` }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${action}$`) }));
    mockMutationState.isPending = true;
    view.rerender(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: pendingLabel })).toBeDisabled();
  });

  it('shows which draft is being published', () => {
    mockListingState.status = 'draft';
    mockMutationState.isPending = true;
    mockMutationState.variables = { listingId: 'listing-123', status: 'published' };
    renderListings();

    const publishButton = screen.getByRole('button', { name: 'Publish listing listing-123' });
    expect(publishButton).toHaveTextContent('Publishing...');
    expect(publishButton).toBeDisabled();
  });

  it.each([
    ['a dropped connection', networkFailures.postgrest,
      'We could not delete this listing because PetSwap could not be reached. Check your connection and try again.'],
    ['an unexpected failure', new Error('boom'),
      'We could not delete this listing. Something went wrong on our side; please try again.'],
  ])('explains %s and offers to try again', async (_, failure, explanation) => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockRejectedValueOnce(failure);
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(explanation);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('keeps the action label when the refusal will not change on a retry', async () => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockRejectedValueOnce({ code: 'P0001', message: 'Listing has active bookings and cannot be deleted.' });
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pending or confirmed bookings');
    expect(screen.getByRole('button', { name: /^Delete$/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('confirms the deletion when a retry after a dropped connection succeeds', async () => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockRejectedValueOnce(networkFailures.postgrest);
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('status')).toHaveTextContent('"Quiet home" was deleted.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(2);
  });

  it('sends one request when an action is confirmed twice in quick succession', async () => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockReturnValue(new Promise(() => {}));
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.dblClick(screen.getByRole('button', { name: /^Delete$/ }));

    expect(mockDeleteMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('sends one request when Publish is pressed twice in quick succession', async () => {
    const user = userEvent.setup();
    mockListingState.status = 'draft';
    mockMutateAsync.mockReturnValue(new Promise(() => {}));
    renderListings();

    await user.dblClick(screen.getByRole('button', { name: 'Publish listing listing-123' }));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('explains on the card why publishing was refused', async () => {
    const user = userEvent.setup();
    mockListingState.status = 'draft';
    mockMutateAsync.mockRejectedValueOnce({ code: '42501', message: 'permission denied for table listings' });
    renderListings();

    await user.click(screen.getByRole('button', { name: 'Publish listing listing-123' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot publish a listing you do not own.');
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

  it.each([
    ['unauthorized', 'Please sign in again before managing this listing.'],
    ['forbidden', 'You cannot delete a listing you do not own.'],
    ['not_found', 'This listing could not be found. Refresh your listings and try again.'],
    ['deleted', 'This listing has already been deleted. Refresh your listings to continue.'],
  ] as const)('maps a %s delete error to safe owner-facing copy', async (code, message) => {
    const user = userEvent.setup();
    mockDeleteMutateAsync.mockRejectedValueOnce(new ListingError(code, 'internal backend detail'));
    render(
      <MemoryRouter initialEntries={['/listings']}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete listing listing-123' }));
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal backend detail');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
