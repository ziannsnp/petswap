import {
  LISTING_PHOTO_MAX_BYTES,
  partitionListingPhotos,
  type SelectableFile,
} from './listingPhotos';

function photo(name: string, type: string, size: number): SelectableFile {
  return { name, type, size };
}

describe('partitionListingPhotos', () => {
  it('accepts every supported image within the size limit', () => {
    const files = [
      photo('yard.jpg', 'image/jpeg', 1024),
      photo('room.png', 'image/png', 2048),
      photo('cat.webp', 'image/webp', 4096),
      photo('play.gif', 'image/gif', 8192),
    ];

    expect(partitionListingPhotos(files)).toEqual({ accepted: files, rejected: [] });
  });

  it('accepts a file that is exactly at the limit', () => {
    const file = photo('exact.png', 'image/png', LISTING_PHOTO_MAX_BYTES);

    expect(partitionListingPhotos([file])).toEqual({ accepted: [file], rejected: [] });
  });

  it('rejects an unsupported type and keeps the rest of the selection', () => {
    const supported = photo('yard.jpg', 'image/jpeg', 1024);

    expect(partitionListingPhotos([supported, photo('notes.pdf', 'application/pdf', 512)])).toEqual({
      accepted: [supported],
      rejected: [
        {
          fileName: 'notes.pdf',
          reason: 'Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.',
        },
      ],
    });
  });

  it('rejects a file over the limit and names the limit in the reason', () => {
    const oversized = photo('huge.png', 'image/png', LISTING_PHOTO_MAX_BYTES + 1);

    expect(partitionListingPhotos([oversized])).toEqual({
      accepted: [],
      rejected: [{ fileName: 'huge.png', reason: 'Larger than the 10 MB limit.' }],
    });
  });
});
