/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LISTING_PHOTO_MAX_BYTES } from '../lib/listingPhotos';
import { CreateListingScreen } from './CreateListingScreen';

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

beforeAll(() => {
  // jsdom has no object URLs, and the previews only need a stable stand-in.
  URL.createObjectURL = jest.fn(() => 'blob:listing-photo');
  URL.revokeObjectURL = jest.fn();
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

  it('labels pet types for people while tracking the pet_species value', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('button', { name: 'Dog' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Cat' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Cat' }));

    expect(screen.getByRole('button', { name: 'Cat' })).toHaveAttribute('aria-pressed', 'true');
  });
});
