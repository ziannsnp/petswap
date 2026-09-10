/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LISTING_PHOTO_MAX_BYTES, LISTING_PHOTO_MAX_COUNT } from '../lib/listingPhotos';
import { CreateListingScreen } from './CreateListingScreen';

jest.mock('../hooks/useCreateListing', () => ({
  useCreateListing: () => ({
    mutateAsync: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
  }),
}));

function fileOfSize(name: string, type: string, size: number): File {
  const file = new File(['photo'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <CreateListingScreen />
    </MemoryRouter>,
  );
}

let objectUrlCount = 0;

beforeAll(() => {
  // jsdom has no object URLs. Handing out a distinct one per call keeps the preview keys
  // unique and lets the removal test assert which URL was released.
  URL.createObjectURL = jest.fn(() => `blob:listing-photo-${(objectUrlCount += 1)}`);
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CreateListingScreen', () => {
  it('accepts a supported photo and shows its preview', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.upload(
      screen.getByLabelText(/add listing photos/i),
      fileOfSize('yard.jpg', 'image/jpeg', 2048),
    );

    expect(screen.getByRole('img', { name: 'yard.jpg' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects an oversized photo with a reason and keeps the rest of the form', async () => {
    const user = userEvent.setup();
    renderScreen();

    const title = screen.getByLabelText(/listing title/i);
    await user.type(title, 'Quiet home near the park');

    await user.upload(
      screen.getByLabelText(/add listing photos/i),
      fileOfSize('huge.png', 'image/png', LISTING_PHOTO_MAX_BYTES + 1),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('huge.png: Larger than the 10 MB limit.');
    expect(title).toHaveValue('Quiet home near the park');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('rejects an unsupported file while keeping the supported one from the same selection', () => {
    renderScreen();

    // userEvent.upload applies the input's `accept` filter. That filter is exactly what
    // a person bypasses by picking "All files" in the OS dialog, so the selection is
    // dispatched directly here to exercise the guard that actually has to hold.
    fireEvent.change(screen.getByLabelText(/add listing photos/i), {
      target: {
        files: [
          fileOfSize('yard.jpg', 'image/jpeg', 2048),
          fileOfSize('notes.pdf', 'application/pdf', 512),
        ],
      },
    });

    expect(screen.getByRole('img', { name: 'yard.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'notes.pdf: Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.',
    );
  });

  it('reports required fields only after a save attempt, then clears each as it is corrected', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.queryByText('Listing title is required.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save listing/i }));
    expect(screen.getByText('Listing title is required.')).toBeInTheDocument();
    expect(screen.getByText('Location is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/listing title/i), 'Quiet home near the park');

    expect(screen.queryByText('Listing title is required.')).not.toBeInTheDocument();
    expect(screen.getByText('Location is required.')).toBeInTheDocument();
  });

  it('selects and deselects a facility independently of the others', async () => {
    const user = userEvent.setup();
    renderScreen();

    const fencedYard = screen.getByRole('checkbox', { name: 'Fenced yard' });
    const airConditioning = screen.getByRole('checkbox', { name: 'Air conditioning' });
    expect(fencedYard).not.toBeChecked();

    await user.click(fencedYard);
    await user.click(airConditioning);
    expect(fencedYard).toBeChecked();
    expect(airConditioning).toBeChecked();

    await user.click(fencedYard);
    expect(fencedYard).not.toBeChecked();
    expect(airConditioning).toBeChecked();
  });

  it('releases the object URL of a removed photo and leaves the others alone', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.upload(screen.getByLabelText(/add listing photos/i), [
      fileOfSize('yard.jpg', 'image/jpeg', 2048),
      fileOfSize('room.png', 'image/png', 2048),
    ]);

    const removedUrl = screen.getByRole('img', { name: 'yard.jpg' }).getAttribute('src');
    const keptUrl = screen.getByRole('img', { name: 'room.png' }).getAttribute('src');

    await user.click(screen.getByRole('button', { name: 'Remove yard.jpg' }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(removedUrl);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(keptUrl);
    expect(screen.queryByRole('img', { name: 'yard.jpg' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'room.png' })).toBeInTheDocument();
  });

  it('applies the photo cap across selections, not just within one', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.upload(
      screen.getByLabelText(/add listing photos/i),
      Array.from({ length: LISTING_PHOTO_MAX_COUNT }, (_, index) =>
        fileOfSize(`photo-${index}.jpg`, 'image/jpeg', 1024)),
    );
    expect(screen.getAllByRole('img')).toHaveLength(LISTING_PHOTO_MAX_COUNT);

    await user.upload(
      screen.getByLabelText(/add more/i),
      fileOfSize('one-too-many.jpg', 'image/jpeg', 1024),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'one-too-many.jpg: A listing can have at most 10 photos.',
    );
    expect(screen.getAllByRole('img')).toHaveLength(LISTING_PHOTO_MAX_COUNT);
  });

  it('clears the cap message once a photo is removed', async () => {
    const user = userEvent.setup();
    renderScreen();

    // 1. select ten photos
    await user.upload(
      screen.getByLabelText(/add listing photos/i),
      Array.from({ length: LISTING_PHOTO_MAX_COUNT }, (_, index) =>
        fileOfSize(`photo-${index}.jpg`, 'image/jpeg', 1024)),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // 2. select an eleventh
    await user.upload(
      screen.getByLabelText(/add more/i),
      fileOfSize('eleventh.jpg', 'image/jpeg', 1024),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'eleventh.jpg: A listing can have at most 10 photos.',
    );

    // 3. remove one of the photos the form already holds
    await user.click(screen.getByRole('button', { name: 'Remove photo-0.jpg' }));

    // 4. the cap message is gone now that there is room again
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(LISTING_PHOTO_MAX_COUNT - 1);
  });

  it('keeps a reason about the file after a removal but drops the capacity one', async () => {
    const user = userEvent.setup();
    renderScreen();

    // One selection that produces both kinds: the PDF is rejected on its own merits, and
    // extra.jpg only because ten photos were already accepted ahead of it.
    fireEvent.change(screen.getByLabelText(/add listing photos/i), {
      target: {
        files: [
          ...Array.from({ length: LISTING_PHOTO_MAX_COUNT }, (_, index) =>
            fileOfSize(`photo-${index}.jpg`, 'image/jpeg', 1024)),
          fileOfSize('notes.pdf', 'application/pdf', 512),
          fileOfSize('extra.jpg', 'image/jpeg', 1024),
        ],
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('notes.pdf: Unsupported file type.');
    expect(screen.getByRole('alert')).toHaveTextContent('extra.jpg: A listing can have at most 10 photos.');

    await user.click(screen.getByRole('button', { name: 'Remove photo-0.jpg' }));

    // notes.pdf is still a PDF, so that reason stays; the listing is no longer full.
    expect(screen.getByRole('alert')).toHaveTextContent('notes.pdf: Unsupported file type.');
    expect(screen.queryByText(/at most 10 photos/)).not.toBeInTheDocument();
  });

  it('labels pet types for people while tracking the pet_species value', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('button', { name: 'Dog' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cat' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Cat' }));

    expect(screen.getByRole('button', { name: 'Cat' })).toHaveAttribute('aria-pressed', 'true');
  });
});
