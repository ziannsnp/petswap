import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Database } from '@/shared/types/database.types';
import { serializeFacilities } from './listingOptions';
import type { Facility, PetSpecies } from './listingOptions';
import { LISTING_PHOTO_MAX_COUNT } from './listingPhotos';

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

export type ListingImage = Database['public']['Tables']['listing_images']['Row'] & {
  signed_url: string;
};

export type Listing = Database['public']['Tables']['listings']['Row'] & {
  listing_images: ListingImage[];
  cover_photo_url: string | null;
};

export type ListingHost = Database['public']['Functions']['get_listing_host']['Returns'][number];

export type ListingDetail = Listing & {
  host: ListingHost;
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
      const { error: listingCleanupError } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id);
      if (listingCleanupError) throw listingCleanupError;
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

async function addSignedPhotoUrls(
  listing: Database['public']['Tables']['listings']['Row'] & {
    listing_images: Database['public']['Tables']['listing_images']['Row'][];
  },
): Promise<Listing> {
  const listingImages = [...listing.listing_images].sort((left, right) => left.sort_order - right.sort_order);
  if (listingImages.length === 0) {
    return { ...listing, listing_images: [], cover_photo_url: null };
  }

  const { data: signedPhotos, error } = await getSupabaseClient().storage
    .from('listing-photos')
    .createSignedUrls(
      listingImages.map((image) => image.storage_path),
      LISTING_PHOTO_SIGNED_URL_TTL_SECONDS,
    );

  if (error) throw error;

  const signedUrlByPath = new Map(
    (signedPhotos ?? [])
      .filter((photo) => Boolean(photo.signedUrl))
      .map((photo) => [photo.path, photo.signedUrl]),
  );
  const imagesWithUrls = listingImages.map((image) => {
    const signedUrl = signedUrlByPath.get(image.storage_path);
    if (!signedUrl) throw new Error(`Could not create a private photo URL for ${image.storage_path}.`);
    return { ...image, signed_url: signedUrl };
  });

  return { ...listing, listing_images: imagesWithUrls, cover_photo_url: imagesWithUrls[0].signed_url };
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

export async function getListing(listingId: string): Promise<ListingDetail> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_images(*)')
    .eq('id', listingId)
    .neq('status', 'deleted')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Listing not found.');

  const { data: host, error: hostError } = await supabase
    .rpc('get_listing_host', { target_listing_id: listingId })
    .maybeSingle();

  if (hostError) throw hostError;
  if (!host) throw new Error('Listing host not found.');

  return {
    ...await addSignedPhotoUrls({ ...data, listing_images: data.listing_images ?? [] }),
    host,
  };
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
    .neq('status', 'deleted')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return Promise.all((data ?? []).map((listing) => addSignedPhotoUrls({
    ...listing,
    listing_images: listing.listing_images ?? [],
  })));
}
