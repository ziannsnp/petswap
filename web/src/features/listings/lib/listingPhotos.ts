/**
 * These limits mirror the `listing-photos` bucket created in
 * `supabase/migrations/20260822013000_initial_mvp_schema.sql`. Storage enforces them
 * on upload; rejecting here only lets the owner see the reason straight away.
 */
export const LISTING_PHOTO_MAX_BYTES = 10_485_760;

/**
 * No functional requirement fixes a photo count; Squad B agreed on ten while reviewing
 * PR #30 on 9 September 2026 — enough for a listing gallery, bounded enough that one
 * listing cannot fill the bucket. The upload integration enforces the same number,
 * because a browser limit is user experience rather than a constraint.
 */
export const LISTING_PHOTO_MAX_COUNT = 10;

export const LISTING_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** The parts of `File` the rules depend on, so callers can be tested without one. */
export type SelectableFile = Pick<File, 'name' | 'type' | 'size'>;

/**
 * A `file` reason describes the file itself, so it stays true for as long as that file is
 * offered. A `capacity` reason describes how full the listing was at the time, so it stops
 * being true the moment a photo is removed.
 */
export type ListingPhotoRejectionKind = 'file' | 'capacity';

export interface RejectedListingPhoto {
  fileName: string;
  reason: string;
  kind: ListingPhotoRejectionKind;
}

export interface PartitionedListingPhotos<T extends SelectableFile> {
  accepted: T[];
  rejected: RejectedListingPhoto[];
}

function describeLimit(): string {
  return `${LISTING_PHOTO_MAX_BYTES / 1_048_576} MB`;
}

function fileReason(file: SelectableFile): string | null {
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
 * `alreadySelected` is how many photos the form is holding, so the cap applies to the
 * listing rather than to one trip through the file picker.
 */
export function partitionListingPhotos<T extends SelectableFile>(
  files: readonly T[],
  alreadySelected = 0,
): PartitionedListingPhotos<T> {
  const accepted: T[] = [];
  const rejected: RejectedListingPhoto[] = [];

  for (const file of files) {
    const reason = fileReason(file);
    if (reason) {
      rejected.push({ fileName: file.name, reason, kind: 'file' });
      continue;
    }

    if (alreadySelected + accepted.length >= LISTING_PHOTO_MAX_COUNT) {
      rejected.push({
        fileName: file.name,
        reason: `A listing can have at most ${LISTING_PHOTO_MAX_COUNT} photos.`,
        kind: 'capacity',
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
