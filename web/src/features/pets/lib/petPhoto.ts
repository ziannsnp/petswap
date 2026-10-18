// Kept apart from petApi so the form can validate photos without loading the Supabase client.

export const PET_PHOTO_MAX_BYTES = 10_485_760;

export const PET_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Validates photo MIME type and size against the storage bucket limits. */
export function validatePetPhoto(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(PET_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.';
  }

  if (file.size > PET_PHOTO_MAX_BYTES) {
    return `Photo is larger than the ${PET_PHOTO_MAX_BYTES / 1_048_576} MB limit.`;
  }

  return null;
}
