import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';
import { serializeFacilities } from './listingOptions';
import type { Facility, PetSpecies } from './listingOptions';
import {
  LISTING_PHOTO_MAX_BYTES,
  LISTING_PHOTO_MAX_COUNT,
  LISTING_PHOTO_MIME_TYPES,
} from './listingPhotos';
import { ListingError, toListingError } from './listingErrors';

export type ListingPublicationMode = 'draft' | 'published';

export interface CreateListingValues {
  title: string;
  location: string;
  description: string;
  capacity: number;
  acceptedPetTypes: PetSpecies[];
  facilities: Facility[];
  photos: File[];
  publicationMode: ListingPublicationMode;
}

export type ListingPhotoInput =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; file: File };

export interface UpdateListingValues {
  title: string;
  location: string;
  description: string;
  capacity: number;
  acceptedPetTypes: PetSpecies[];
  facilities: readonly string[];
  photos: ListingPhotoInput[];
  publicationMode: ListingPublicationMode;
}

export type ListingImage = Database['public']['Tables']['listing_images']['Row'] & {
  signed_url: string | null;
};

export interface ListingHost {
  id: string;
  display_name: string;
  photo_url: string | null;
  location: string | null;
}

export type Listing = Database['public']['Tables']['listings']['Row'] & {
  listing_images: ListingImage[];
  cover_photo_url: string | null;
  /** Team B's detail adapter supplies this minimal public profile projection. */
  host: ListingHost | null;
};

const LISTING_PHOTO_SIGNED_URL_TTL_SECONDS = 3_600;

function photoStoragePath(listingId: string, file: File): string {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
  return `${listingId}/${crypto.randomUUID()}${extension.toLowerCase()}`;
}

async function removeUploadedPhotos(storagePaths: string[]) {
  if (storagePaths.length === 0) return;

  const { error } = await getSupabaseClient().storage.from('listing-photos').remove(storagePaths);
  if (error) throw error;
}

export async function createListing(values: CreateListingValues): Promise<Listing> {
  if (values.photos.length > LISTING_PHOTO_MAX_COUNT) {
    throw new Error(`A listing can have at most ${LISTING_PHOTO_MAX_COUNT} photos.`);
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in to create a listing.');

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      owner_id: userData.user.id,
      title: values.title.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
      capacity: values.capacity,
      accepted_pet_types: values.acceptedPetTypes,
      facilities: serializeFacilities(values.facilities),
      status: 'draft',
      published_at: null,
    })
    .select()
    .single();

  if (listingError) throw listingError;

  const storagePaths: string[] = [];
  try {
    const imageRows: Database['public']['Tables']['listing_images']['Insert'][] = [];

    for (const [sortOrder, photo] of values.photos.entries()) {
      const storagePath = photoStoragePath(listing.id, photo);
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(storagePath, photo, { contentType: photo.type, upsert: false });

      if (uploadError) throw uploadError;
      storagePaths.push(storagePath);
      imageRows.push({
        listing_id: listing.id,
        storage_path: storagePath,
        alt_text: null,
        sort_order: sortOrder,
      });
    }

    let insertedImages: Database['public']['Tables']['listing_images']['Row'][] = [];
    if (imageRows.length > 0) {
      const { data: imageData, error: imagesError } = await supabase
        .from('listing_images')
        .insert(imageRows)
        .select();
      if (imagesError) throw imagesError;
      insertedImages = imageData;
    }

    let savedListing = listing;
    if (values.publicationMode === 'published') {
      const { data: publishedListing, error: publicationError } = await supabase
        .from('listings')
        .update({ status: 'published' })
        .eq('id', listing.id)
        .select()
        .single();

      if (publicationError) throw publicationError;
      savedListing = publishedListing;
    }

    return addSignedPhotoUrls({ ...savedListing, listing_images: insertedImages });
  } catch (error) {
    const cleanupErrors: string[] = [];
    try {
      await removeUploadedPhotos(storagePaths);
    } catch (cleanupError) {
      cleanupErrors.push(`photo cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }

    try {
      await deleteListing(listing.id);
    } catch (listingCleanupError) {
      cleanupErrors.push(`listing cleanup failed: ${listingCleanupError instanceof Error ? listingCleanupError.message : String(listingCleanupError)}`);
    }

    if (cleanupErrors.length > 0) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Listing creation failed: ${originalMessage}; ${cleanupErrors.join('; ')}`);
    }
    throw error;
  }
}

export async function updateListing(listingId: string, values: UpdateListingValues): Promise<Listing> {
  if (values.photos.length > LISTING_PHOTO_MAX_COUNT) {
    throw new Error(`A listing can have at most ${LISTING_PHOTO_MAX_COUNT} photos.`);
  }

  for (const photo of values.photos) {
    if (photo.kind !== 'new') continue;
    if (!(LISTING_PHOTO_MIME_TYPES as readonly string[]).includes(photo.file.type)) {
      throw new Error(`Unsupported file type for ${photo.file.name}. Choose a JPG, PNG, WebP, or GIF file.`);
    }
    if (photo.file.size > LISTING_PHOTO_MAX_BYTES) {
      throw new Error(`${photo.file.name} is larger than the 10 MB limit.`);
    }
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error('You must be signed in to edit a listing.');

  const { data: currentListing, error: currentListingError } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('id', listingId)
    .maybeSingle();

  if (currentListingError) throw currentListingError;
  if (!currentListing || currentListing.owner_id !== userData.user.id) {
    throw new Error('You can only edit your own listings.');
  }

  const currentImages = currentListing.listing_images ?? [];
  const existingImageIds = new Set(currentImages.map((image) => image.id));
  const requestedExistingIds = values.photos
    .filter((photo): photo is { kind: 'existing'; id: string } => photo.kind === 'existing')
    .map((photo) => photo.id);

  if (
    new Set(requestedExistingIds).size !== requestedExistingIds.length
    || requestedExistingIds.some((imageId) => !existingImageIds.has(imageId))
  ) {
    throw new Error('Photo selection must contain each retained listing photo at most once.');
  }

  const uploadedPaths: string[] = [];
  const newImages: Array<{ id: string; storage_path: string; alt_text: null }> = [];
  const orderedImageIds: string[] = [];
  let databaseCommitted = false;
  try {
    for (const photo of values.photos) {
      if (photo.kind === 'existing') {
        orderedImageIds.push(photo.id);
        continue;
      }

      const storagePath = photoStoragePath(listingId, photo.file);
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(storagePath, photo.file, { contentType: photo.file.type, upsert: false });
      if (uploadError) throw uploadError;

      uploadedPaths.push(storagePath);
      const imageId = crypto.randomUUID();
      newImages.push({ id: imageId, storage_path: storagePath, alt_text: null });
      orderedImageIds.push(imageId);
    }

    const removedImageIds = currentImages
      .filter((image) => !requestedExistingIds.includes(image.id))
      .map((image) => image.id);

    const { error: updateError } = await supabase.rpc('update_listing_with_images', {
      target_listing_id: listingId,
      new_title: values.title.trim(),
      new_location: values.location.trim(),
      new_description: values.description.trim(),
      new_capacity: values.capacity,
      new_accepted_pet_types: values.acceptedPetTypes,
      new_facilities: values.facilities.length > 0 ? values.facilities.join('\n') : null,
      new_status: values.publicationMode,
      new_published_at: values.publicationMode === 'published'
        ? (currentListing.published_at ?? new Date().toISOString())
        : null,
      retained_image_ids: requestedExistingIds,
      new_images: newImages,
      ordered_image_ids: orderedImageIds,
    });
    if (updateError) throw updateError;
    databaseCommitted = true;

    const { data: updatedListing, error: reloadError } = await supabase
      .from('listings')
      .select('*, listing_images(*)')
      .eq('id', listingId)
      .single();
    if (reloadError) throw reloadError;

    const removedStoragePaths = currentImages
      .filter((image) => removedImageIds.includes(image.id))
      .map((image) => image.storage_path);
    try {
      await removeUploadedPhotos(removedStoragePaths);
    } catch (cleanupError) {
      void cleanupError;
    }

    return addSignedPhotoUrls({
      ...updatedListing,
      listing_images: updatedListing.listing_images ?? [],
    });
  } catch (error) {
    const cleanupErrors: string[] = [];
    if (!databaseCommitted) {
      try {
        await removeUploadedPhotos(uploadedPaths);
      } catch (cleanupError) {
        cleanupErrors.push(`photo cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    if (cleanupErrors.length > 0) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${originalMessage}; ${cleanupErrors.join('; ')}`);
    }
    throw error;
  }
}

async function addSignedPhotoUrls(
  listing: Database['public']['Tables']['listings']['Row'] & {
    listing_images: Database['public']['Tables']['listing_images']['Row'][];
    host?: ListingHost | null;
  },
): Promise<Listing> {
  const listingImages = [...listing.listing_images].sort((left, right) => left.sort_order - right.sort_order);
  if (listingImages.length === 0) {
    return { ...listing, listing_images: [], cover_photo_url: null, host: listing.host ?? null };
  }

  const { data: signedPhotos, error } = await getSupabaseClient().storage
    .from('listing-photos')
    .createSignedUrls(
      listingImages.map((image) => image.storage_path),
      LISTING_PHOTO_SIGNED_URL_TTL_SECONDS,
    );

  // Photo signing is intentionally best-effort: a missing object or temporary storage
  // failure must not make the listing's text details inaccessible (US-4.3).
  if (error) {
    return {
      ...listing,
      listing_images: listingImages.map((image) => ({ ...image, signed_url: null })),
      cover_photo_url: null,
      host: listing.host ?? null,
    };
  }

  const signedUrlByPath = new Map(
    (signedPhotos ?? [])
      .filter((photo) => Boolean(photo.signedUrl))
      .map((photo) => [photo.path, photo.signedUrl]),
  );
  const imagesWithUrls = listingImages.map((image) => {
    const signedUrl = signedUrlByPath.get(image.storage_path);
    return { ...image, signed_url: signedUrl ?? null };
  });

  return {
    ...listing,
    listing_images: imagesWithUrls,
    cover_photo_url: imagesWithUrls[0]?.signed_url ?? null,
    host: listing.host ?? null,
  };
}

export async function listPublishedListings(): Promise<Listing[]> {
  const { data, error } = await getSupabaseClient()
    .from('listings')
    .select('*, listing_images(*)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map((listing) => addSignedPhotoUrls({
    ...listing,
    listing_images: listing.listing_images ?? [],
  })));
}

export async function getListing(listingId: string): Promise<Listing> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('listings')
      .select('*, listing_images(*)')
      .eq('id', listingId)
      .maybeSingle();

    if (error) throw error;
    // RLS deliberately makes a private listing and a missing id look alike to a
    // non-owner, so the public response does not confirm that a private row exists.
    if (!data) throw new ListingError('not_found', 'This listing is unavailable.');
    if (data.status === 'deleted' || data.deleted_at) {
      throw new ListingError('deleted', 'This listing is no longer available.');
    }

    return addSignedPhotoUrls({ ...data, listing_images: data.listing_images ?? [] });
  } catch (error) {
    throw toListingError(error);
  }
}

export async function setListingPublicationStatus(
  listingId: string,
  status: ListingPublicationMode,
): Promise<Listing> {
  const supabase = getSupabaseClient();

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) {
      throw new ListingError('unauthenticated', 'You must be signed in to update a listing.');
    }

    const { data: currentListing, error: currentError } = await supabase
      .from('listings')
      .select('id, owner_id, status, deleted_at')
      .eq('id', listingId)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentListing) throw new ListingError('not_found', 'The listing could not be found.');
    if (currentListing.owner_id !== userData.user.id) {
      throw new ListingError('forbidden', 'Only the listing owner can change its publication status.');
    }
    if (currentListing.status === 'deleted' || currentListing.deleted_at) {
      throw new ListingError('deleted', 'A deleted listing cannot be published or unpublished.');
    }

    const { data, error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', listingId)
      .eq('owner_id', userData.user.id)
      .is('deleted_at', null)
      .select('*, listing_images(*)')
      .single();

    if (error) throw error;

    return addSignedPhotoUrls({ ...data, listing_images: data.listing_images ?? [] });
  } catch (error) {
    throw toListingError(error);
  }
}

export async function deleteListing(listingId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('delete_listing_with_active_booking_check', {
    target_listing_id: listingId,
  });

  if (error) throw error;
}

export async function listMyListings(): Promise<Listing[]> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map((listing) => addSignedPhotoUrls({
    ...listing,
    listing_images: listing.listing_images ?? [],
  })));
}
