/**
 * These limits mirror the `listing-photos` bucket created in
 * `supabase/migrations/20260822013000_initial_mvp_schema.sql`. Storage enforces them
 * on upload; rejecting here only lets the owner see the reason straight away.
 */
export const LISTING_PHOTO_MAX_BYTES = 10_485_760;

export const LISTING_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** The parts of `File` the rules depend on, so callers can be tested without one. */
export type SelectableFile = Pick<File, 'name' | 'type' | 'size'>;

export interface RejectedListingPhoto {
  fileName: string;
  reason: string;
}

export interface PartitionedListingPhotos<T extends SelectableFile> {
  accepted: T[];
  rejected: RejectedListingPhoto[];
}

function describeLimit(): string {
  return `${LISTING_PHOTO_MAX_BYTES / 1_048_576} MB`;
}

function rejectionReason(file: SelectableFile): string | null {
  if (!(LISTING_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.';
  }

  if (file.size > LISTING_PHOTO_MAX_BYTES) {
    return `Larger than the ${describeLimit()} limit.`;
  }

  return null;
}

/**
 * Splits a selection so the caller can keep the valid photos and explain the rest.
 * Rejecting a file never affects the others, which is what FR-3.1's photo rule asks for.
 */
export function partitionListingPhotos<T extends SelectableFile>(
  files: readonly T[],
): PartitionedListingPhotos<T> {
  const accepted: T[] = [];
  const rejected: RejectedListingPhoto[] = [];

  for (const file of files) {
    const reason = rejectionReason(file);
    if (reason) {
      rejected.push({ fileName: file.name, reason });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}
