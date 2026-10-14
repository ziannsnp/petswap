/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ListingImage } from '../lib/listingApi';
import { ListingPhotoGallery } from './ListingPhotoGallery';

function photo(id: string, signedUrl: string | null, altText: string | null = null): ListingImage {
  return {
    id,
    listing_id: 'listing-1',
    storage_path: `listing-1/${id}.jpg`,
    alt_text: altText,
    sort_order: Number(id.replace(/\D/g, '')),
    created_at: '2026-09-01T00:00:00.000Z',
    signed_url: signedUrl,
  };
}

describe('ListingPhotoGallery', () => {
  it('uses stored alt text and supports thumbnail and keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <ListingPhotoGallery
        listingTitle="Quiet home"
        photos={[
          photo('photo-1', 'https://example.test/one.jpg', 'Fenced garden'),
          photo('photo-2', 'https://example.test/two.jpg'),
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: 'Fenced garden' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Show photo 2 of 2' }));
    expect(screen.getByRole('img', { name: 'Quiet home photo 2' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('region', { name: 'Listing photos' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('img', { name: 'Fenced garden' })).toBeInTheDocument();
  });

  it('keeps the gallery usable when a signed URL is missing or an image fails', () => {
    render(
      <ListingPhotoGallery
        listingTitle="Quiet home"
        photos={[photo('photo-1', 'https://example.test/broken.jpg'), photo('photo-2', null)]}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Quiet home photo 1' }));
    expect(screen.getByRole('img', { name: 'Quiet home photo unavailable' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Show photo 2 of 2' }));
    expect(screen.getByRole('img', { name: 'Quiet home photo unavailable' })).toBeInTheDocument();
  });

  it('shows an accessible placeholder when the listing has no photos', () => {
    render(<ListingPhotoGallery listingTitle="Quiet home" photos={[]} />);
    expect(screen.getByRole('img', { name: 'Quiet home photo unavailable' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('clamps the selected photo when refreshed data removes later photos', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ListingPhotoGallery
        listingTitle="Quiet home"
        photos={[
          photo('photo-1', 'https://example.test/one.jpg'),
          photo('photo-2', 'https://example.test/two.jpg'),
          photo('photo-3', 'https://example.test/three.jpg'),
        ]}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Show photo 3 of 3' }));
    rerender(<ListingPhotoGallery listingTitle="Quiet home" photos={[photo('photo-1', 'https://example.test/one.jpg')]} />);

    expect(screen.getByRole('img', { name: 'Quiet home photo 1' })).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });
});
