import { PET_PHOTO_MAX_BYTES, PET_PHOTO_MIME_TYPES, validatePetPhoto } from './petPhoto';

describe('validatePetPhoto', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])('accepts valid MIME type %s', (type) => {
    expect(validatePetPhoto({ type, size: 1024 })).toBeNull();
  });

  // SVG can carry scripts, and HEIC does not render in most browsers.
  it.each(['image/svg+xml', 'image/heic', 'application/pdf', 'application/octet-stream', ''])(
    'rejects unsupported MIME type %p',
    (type) => {
      expect(validatePetPhoto({ type, size: 1024 })).toBe('Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.');
    },
  );

  it('accepts photos up to the 10 MB limit and rejects photos exceeding it', () => {
    expect(PET_PHOTO_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES })).toBeNull();
    expect(validatePetPhoto({ type: 'image/png', size: PET_PHOTO_MAX_BYTES + 1 })).toBe('Photo is larger than the 10 MB limit.');
  });

  it('reports the file type first when a file is both unsupported and too large', () => {
    expect(validatePetPhoto({ type: 'application/pdf', size: PET_PHOTO_MAX_BYTES + 1 })).toMatch(/unsupported file type/i);
  });

  // The pet-photos bucket enforces the same list, so the two must change together.
  it('allows exactly the MIME types the pet-photos bucket allows', () => {
    expect([...PET_PHOTO_MIME_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  });
});
