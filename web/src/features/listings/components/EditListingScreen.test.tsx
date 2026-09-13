/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useMyListings } from '../hooks/useListings';
import { useUpdateListing } from '../hooks/useUpdateListing';
import type { Listing } from '../lib/listingApi';
import { EditListingScreen } from './EditListingScreen';

jest.mock('../hooks/useListings', () => ({
  useMyListings: jest.fn(),
}));

jest.mock('../hooks/useUpdateListing', () => ({
  useUpdateListing: jest.fn(),
}));

const mockedUseMyListings = jest.mocked(useMyListings);
const mockedUseUpdateListing = jest.mocked(useUpdateListing);

const sunnyRoom: Listing = {
  id: 'listing-1',
  owner_id: 'owner-1',
  title: 'Sunny garden room',
  location: 'Chiang Mai',
  description: 'Fenced garden, quiet street.',
  capacity: 2,
  accepted_pet_types: ['dog', 'cat'],
  facilities: 'Lawn\nAir-conditioned room\nVet 5 minutes away',
  status: 'published',
  deleted_at: null,
  published_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  listing_images: [
    { id: 'img-1', listing_id: 'listing-1', storage_path: 'listing-1/a.jpg', alt_text: 'Garden', sort_order: 0, created_at: '2026-09-01T00:00:00.000Z', signed_url: 'https://storage.test/signed/a.jpg' },
    { id: 'img-2', listing_id: 'listing-1', storage_path: 'listing-1/b.jpg', alt_text: null, sort_order: 1, created_at: '2026-09-01T00:00:00.000Z', signed_url: 'https://storage.test/signed/b.jpg' },
  ],
  cover_photo_url: 'https://storage.test/signed/a.jpg',
};

function listingsQuery(overrides: Partial<ReturnType<typeof useMyListings>>) {
  return { data: undefined, isPending: false, isError: false, ...overrides } as ReturnType<typeof useMyListings>;
}

function renderAt(listingId: string) {
  return render(
    <MemoryRouter initialEntries={[`/listings/${listingId}/edit`]}>
      <Routes>
        <Route path="/listings/:listingId/edit" element={<EditListingScreen />} />
        <Route path="/listings" element={<p>My listings page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  mockedUseUpdateListing.mockReturnValue({
    isPending: false,
    isError: false,
    mutateAsync: jest.fn().mockResolvedValue(sunnyRoom),
  } as never);
});

describe('EditListingScreen', () => {
  it('shows a loading state while the listings are pending', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ isPending: true }));
    renderAt('listing-1');

    expect(screen.getByLabelText('Loading listing')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows an error state when the listings cannot be loaded', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ isError: true }));
    renderAt('listing-1');

    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your listing');
  });

  it('reports a listing that is not among the owner\'s own', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('someone-elses-listing');

    expect(screen.getByText('We could not find that listing')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Back to my listings' })) {
      expect(link).toHaveAttribute('href', '/listings');
    }
    expect(screen.queryByLabelText(/listing title/i)).not.toBeInTheDocument();
  });

  it('refuses the direct route for a soft-deleted listing the owner still owns', () => {
    mockedUseMyListings.mockReturnValue(
      listingsQuery({ data: [{ ...sunnyRoom, status: 'deleted', deleted_at: '2026-09-10T00:00:00.000Z' }] }),
    );
    renderAt('listing-1');

    expect(screen.getByText('We could not find that listing')).toBeInTheDocument();
    expect(screen.queryByLabelText(/listing title/i)).not.toBeInTheDocument();
  });

  it('follows a background refetch of the same listing while the form is untouched', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    const view = renderAt('listing-1');
    expect(screen.getByLabelText(/listing title/i)).toHaveValue('Sunny garden room');

    // Same id, newer values: what TanStack Query hands back after a stale cache is refreshed.
    mockedUseMyListings.mockReturnValue(
      listingsQuery({ data: [{ ...sunnyRoom, title: 'Sunny garden room (renamed elsewhere)', capacity: 4 }] }),
    );
    view.rerender(
      <MemoryRouter initialEntries={['/listings/listing-1/edit']}>
        <Routes>
          <Route path="/listings/:listingId/edit" element={<EditListingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/listing title/i)).toHaveValue('Sunny garden room (renamed elsewhere)');
    expect(screen.getByLabelText(/capacity/i)).toHaveValue(4);
  });

  it('keeps the owner\'s typing when a background refetch lands after they started editing', async () => {
    const user = userEvent.setup();
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    const view = renderAt('listing-1');

    await user.clear(screen.getByLabelText(/listing title/i));
    await user.type(screen.getByLabelText(/listing title/i), 'My own new title');

    mockedUseMyListings.mockReturnValue(
      listingsQuery({ data: [{ ...sunnyRoom, title: 'Sunny garden room (renamed elsewhere)', capacity: 4 }] }),
    );
    view.rerender(
      <MemoryRouter initialEntries={['/listings/listing-1/edit']}>
        <Routes>
          <Route path="/listings/:listingId/edit" element={<EditListingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/listing title/i)).toHaveValue('My own new title');
    expect(screen.getByLabelText(/capacity/i)).toHaveValue(2);
  });

  it('prefills every field from the stored listing', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    expect(screen.getByLabelText(/listing title/i)).toHaveValue('Sunny garden room');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Chiang Mai');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Fenced garden, quiet street.');
    expect(screen.getByLabelText(/capacity/i)).toHaveValue(2);

    expect(screen.getByRole('button', { name: 'Dog' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cat' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rabbit' })).toHaveAttribute('aria-pressed', 'false');

    expect(screen.getByRole('checkbox', { name: 'Lawn' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Air-conditioned room' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Security cameras' })).not.toBeChecked();
  });

  it('shows stored facilities that are not one of the checkbox options', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    expect(screen.getByText(/also listed:/i).closest('p')).toHaveTextContent('Vet 5 minutes away');
    expect(screen.queryByRole('checkbox', { name: 'Vet 5 minutes away' })).not.toBeInTheDocument();
  });

  it('shows a stored pet type the form does not normally offer, already selected', () => {
    mockedUseMyListings.mockReturnValue(
      listingsQuery({ data: [{ ...sunnyRoom, accepted_pet_types: ['dog', 'hamster'] }] }),
    );
    renderAt('listing-1');

    expect(screen.getByRole('button', { name: 'Hamster' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows controls to add, remove, and reorder existing photos', () => {
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    expect(screen.getByRole('img', { name: 'Garden' })).toHaveAttribute('src', 'https://storage.test/signed/a.jpg');
    expect(screen.getByRole('img', { name: 'Sunny garden room photo 2' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove photo/i })).toHaveLength(2);
    expect(screen.getByText('Add photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move photo 1 down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move photo 1 up' })).toBeDisabled();
  });

  it('removes a photo from the update payload', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue(sunnyRoom);
    mockedUseUpdateListing.mockReturnValue({ isPending: false, isError: false, mutateAsync } as never);
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      values: expect.objectContaining({
        photos: [{ kind: 'existing', id: 'img-2' }],
      }),
    }));
  });

  it('does not upload a newly added photo again on a consecutive save', async () => {
    const user = userEvent.setup();
    const persistedNewImage = {
      ...sunnyRoom.listing_images[1],
      id: 'img-new',
      storage_path: 'listing-1/new-yard.jpg',
      signed_url: 'https://storage.test/signed/new-yard.jpg',
    };
    const savedListing: Listing = {
      ...sunnyRoom,
      listing_images: [sunnyRoom.listing_images[0], persistedNewImage],
    };
    const mutateAsync = jest.fn().mockResolvedValue(savedListing);
    mockedUseUpdateListing.mockReturnValue({ isPending: false, isError: false, mutateAsync } as never);
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    const file = new File(['photo'], 'new-yard.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/add photos/i), file);
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1][0].values.photos).toEqual([
      { kind: 'existing', id: 'img-1' },
      { kind: 'existing', id: 'img-new' },
    ]);
  });

  it('shows an empty photo state for a listing with no photos', () => {
    mockedUseMyListings.mockReturnValue(
      listingsQuery({ data: [{ ...sunnyRoom, listing_images: [], cover_photo_url: null }] }),
    );
    renderAt('listing-1');

    expect(screen.getByText('No photos yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('refuses to save when a required value is removed, and keeps the rest of the form', async () => {
    const user = userEvent.setup();
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    await user.clear(screen.getByLabelText(/listing title/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText('Listing title is required.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toHaveValue('Chiang Mai');
    expect(screen.getByRole('checkbox', { name: 'Lawn' })).toBeChecked();
  });

  it('refuses to save with every pet type deselected, matching the database rule', async () => {
    const user = userEvent.setup();
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    await user.click(screen.getByRole('button', { name: 'Dog' }));
    await user.click(screen.getByRole('button', { name: 'Cat' }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText('Choose at least one accepted pet type.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('confirms when the edited values are valid', async () => {
    const user = userEvent.setup();
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    await user.clear(screen.getByLabelText(/listing title/i));
    await user.type(screen.getByLabelText(/listing title/i), 'Sunny garden room, renovated');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Changes saved successfully.');
  });

  it('returns to My listings on cancel without saving', async () => {
    const user = userEvent.setup();
    mockedUseMyListings.mockReturnValue(listingsQuery({ data: [sunnyRoom] }));
    renderAt('listing-1');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('My listings page')).toBeInTheDocument();
  });
});
