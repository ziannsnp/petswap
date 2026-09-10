import {
  LISTING_PHOTO_MAX_BYTES,
  LISTING_PHOTO_MAX_COUNT,
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
          kind: 'file',
        },
      ],
    });
  });

  it('rejects a file over the limit and names the limit in the reason', () => {
    const oversized = photo('huge.png', 'image/png', LISTING_PHOTO_MAX_BYTES + 1);

    expect(partitionListingPhotos([oversized])).toEqual({
      accepted: [],
      rejected: [
        { fileName: 'huge.png', reason: 'Larger than the 10 MB limit.', kind: 'file' },
      ],
    });
  });
});

describe('partitionListingPhotos photo cap', () => {
  const supported = (name: string) => photo(name, 'image/jpeg', 1024);

  it('rejects the files that would take the listing past the cap', () => {
    const files = Array.from({ length: 12 }, (_, index) => supported(`photo-${index}.jpg`));

    const { accepted, rejected } = partitionListingPhotos(files);

    expect(accepted).toHaveLength(LISTING_PHOTO_MAX_COUNT);
    expect(rejected).toEqual([
      { fileName: 'photo-10.jpg', reason: 'A listing can have at most 10 photos.', kind: 'capacity' },
      { fileName: 'photo-11.jpg', reason: 'A listing can have at most 10 photos.', kind: 'capacity' },
    ]);
  });

  it('counts photos the form already holds, not just this selection', () => {
    const { accepted, rejected } = partitionListingPhotos(
      [supported('ninth.jpg'), supported('tenth.jpg'), supported('eleventh.jpg')],
      8,
    );

    expect(accepted.map((file) => file.name)).toEqual(['ninth.jpg', 'tenth.jpg']);
    expect(rejected).toEqual([
      { fileName: 'eleventh.jpg', reason: 'A listing can have at most 10 photos.', kind: 'capacity' },
    ]);
  });

  it('reports an unsupported file by its own reason rather than the cap', () => {
    const { rejected } = partitionListingPhotos([photo('notes.pdf', 'application/pdf', 512)], 10);

    expect(rejected).toEqual([
      {
        fileName: 'notes.pdf',
        reason: 'Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.',
        kind: 'file',
      },
    ]);
  });

  it('labels a full listing as capacity and a bad file as file', () => {
    const { rejected } = partitionListingPhotos(
      [photo('notes.pdf', 'application/pdf', 512), photo('extra.jpg', 'image/jpeg', 1024)],
      LISTING_PHOTO_MAX_COUNT,
    );

    expect(rejected.map((r) => [r.fileName, r.kind])).toEqual([
      ['notes.pdf', 'file'],
      ['extra.jpg', 'capacity'],
    ]);
  });
});
