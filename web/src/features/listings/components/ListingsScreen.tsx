import { useEffect, useRef, useState } from 'react';
import { Home, Image, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDeleteListing, useMyListings, useSetListingPublicationStatus } from '../hooks/useListings';
import { listingErrorCode } from '../lib/listingErrors';
import type { ListingErrorCode } from '../lib/listingErrors';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import { LISTING_STATUS_STYLES } from '../lib/listingStatus';
import type { Listing } from '../lib/listingApi';
import { ListingActionDialog } from './ListingActionDialog';

type ListingAction = 'unpublish' | 'delete';

interface ActionFailure {
  message: string;
  /** Network and unknown failures may succeed on a second attempt; the others will not. */
  canRetry: boolean;
}

function describeActionFailure(action: ListingAction | 'publish', error: unknown): ActionFailure {
  const code: ListingErrorCode = listingErrorCode(error);
  switch (code) {
    case 'active_booking':
      return { message: 'This listing has pending or confirmed bookings and cannot be deleted.', canRetry: false };
    case 'unauthorized':
      return { message: 'Please sign in again before managing this listing.', canRetry: false };
    case 'forbidden':
      return { message: `You cannot ${action} a listing you do not own.`, canRetry: false };
    case 'not_found':
      return { message: 'This listing could not be found. Refresh your listings and try again.', canRetry: false };
    case 'deleted':
      return { message: 'This listing has already been deleted. Refresh your listings to continue.', canRetry: false };
    case 'network':
      return {
        message: `We could not ${action} this listing because PetSwap could not be reached. Check your connection and try again.`,
        canRetry: true,
      };
    default:
      return { message: `We could not ${action} this listing. Something went wrong on our side; please try again.`, canRetry: true };
  }
}

interface PendingListingAction {
  action: ListingAction;
  listing: Listing;
}

interface ListingCardProps {
  listing: Listing;
  isPending: boolean;
  isPublishing: boolean;
  publishError: string | null;
  onRequestAction: (action: ListingAction, listing: Listing) => void;
  onPublish: () => void;
}

function ListingCard({ listing, isPending, isPublishing, publishError, onRequestAction, onPublish }: ListingCardProps) {
  const status = LISTING_STATUS_STYLES[listing.status];
  const isPublished = listing.status === 'published';

  // The preview link and the edit link are siblings: an anchor cannot contain another
  // anchor, so the card body is one link and the owner action sits in its own footer.
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:border-brand-500">
      <Link className="block" to={`/listings/${listing.id}`}>
        <div className="aspect-video bg-gray-100">
          {listing.cover_photo_url ? (
            <img
              className="h-full w-full object-cover"
              src={listing.cover_photo_url}
              alt={listing.listing_images[0]?.alt_text ?? listing.title}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <Image className="h-9 w-9" aria-hidden="true" />
              <span>No photo yet</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-base font-semibold text-gray-900 break-words">{listing.title}</h2>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{listing.location}</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Listing details">
            {listing.accepted_pet_types.map((petType) => (
              <span className="badge-brand" key={petType}>{petSpeciesLabel(petType)}</span>
            ))}
            <span className="badge-brand">Up to {listing.capacity} pets</span>
          </div>
        </div>
      </Link>
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => isPublished
              ? onRequestAction('unpublish', listing)
              : onPublish()}
            disabled={isPending}
            aria-label={`${isPublished ? 'Unpublish' : 'Publish'} listing ${listing.id}`}
          >
            {isPublishing ? 'Publishing...' : (isPublished ? 'Unpublish' : 'Publish')}
          </button>
          <Link
            className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            to={`/listings/${listing.id}/edit`}
            aria-label={`Edit listing ${listing.id}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </Link>
        </div>
        <button
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm text-red-700 hover:text-red-900 disabled:opacity-60"
          type="button"
          onClick={() => onRequestAction('delete', listing)}
          disabled={isPending}
          aria-label={`Delete listing ${listing.id}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
        {publishError && (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {publishError}
          </p>
        )}
      </div>
    </article>
  );
}

export function ListingsScreen() {
  const location = useLocation();
  const { data: listings = [], isPending, isError } = useMyListings();
  const publicationMutation = useSetListingPublicationStatus();
  const deleteMutation = useDeleteListing();
  const [pendingAction, setPendingAction] = useState<PendingListingAction | null>(null);
  const [actionFailure, setActionFailure] = useState<ActionFailure | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletedListingId, setDeletedListingId] = useState<string | null>(null);
  const [publishFailure, setPublishFailure] = useState<{ listingId: string; message: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set synchronously, so a second click that lands before React re-renders with the
  // disabled buttons cannot send the same request twice.
  const actionInFlight = useRef(false);
  const activeListings = listings.filter((listing) => listing.status !== 'deleted');
  const isActionPending = publicationMutation.isPending || deleteMutation.isPending;
  const publishingListingId = publicationMutation.isPending && publicationMutation.variables?.status === 'published'
    ? publicationMutation.variables.listingId
    : null;
  const listingSaved = location.state?.listingSaved === 'draft' || location.state?.listingSaved === 'published'
    ? location.state.listingSaved
    : null;

  useEffect(() => {
    if (!deletedListingId || pendingAction) return;
    headingRef.current?.focus();
    setDeletedListingId(null);
  }, [deletedListingId, pendingAction]);

  const requestAction = (action: ListingAction, listing: Listing) => {
    setActionFailure(null);
    setActionSuccess(null);
    setPendingAction({ action, listing });
  };

  const publishListing = async (listing: Listing) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setPublishFailure(null);
    setActionSuccess(null);
    try {
      await publicationMutation.mutateAsync({ listingId: listing.id, status: 'published' });
      setActionSuccess(`"${listing.title}" is now published. Pet owners can find it in search.`);
    } catch (error) {
      setPublishFailure({ listingId: listing.id, message: describeActionFailure('publish', error).message });
    } finally {
      actionInFlight.current = false;
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    setActionFailure(null);
  };

  const confirmAction = async () => {
    if (!pendingAction || actionInFlight.current) return;
    actionInFlight.current = true;
    setActionFailure(null);
    try {
      const { listing } = pendingAction;
      if (pendingAction.action === 'unpublish') {
        await publicationMutation.mutateAsync({ listingId: listing.id, status: 'draft' });
        setActionSuccess(`"${listing.title}" is now unpublished. It no longer appears in search, and existing bookings are unchanged.`);
      } else {
        await deleteMutation.mutateAsync(listing.id);
        setDeletedListingId(listing.id);
        setActionSuccess(`"${listing.title}" was deleted. It no longer appears in search or in your listings.`);
      }
      setPendingAction(null);
    } catch (error) {
      setActionFailure(describeActionFailure(pendingAction.action, error));
    } finally {
      actionInFlight.current = false;
    }
  };

  const actionName = pendingAction?.action === 'unpublish' ? 'Unpublish' : 'Delete';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="page-container">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-brand-700">Hosting</p>
            <h1 ref={headingRef} className="text-2xl font-bold sm:text-3xl" tabIndex={-1}>My listings</h1>
          </div>
          <Link className="btn-primary flex min-h-11 items-center justify-center gap-2" to="/listings/new">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Create listing</span>
            <span className="sr-only sm:hidden">Create listing</span>
          </Link>
        </div>

        {actionSuccess && (
          <p className="mb-6 border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {actionSuccess}
          </p>
        )}

        {listingSaved && !actionSuccess && (
          <p className="mb-6 border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            {listingSaved === 'published'
              ? 'Listing published successfully. Pet owners can now discover it.'
              : 'Draft saved successfully. Only you can view it until you publish it.'}
          </p>
        )}

        {isPending && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2" aria-label="Loading listings" aria-busy="true">
            {[0, 1].map((item) => (
              <div className="min-h-80 animate-pulse rounded-lg border border-gray-100 bg-gray-200" key={item} />
            ))}
          </div>
        )}

        {isError && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">We could not load your listings</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection and Supabase environment, then refresh the page.</p>
          </section>
        )}

        {!isPending && !isError && activeListings.length === 0 && (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
            <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No listings yet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">Create your first place listing to offer in-home pet care.</p>
            <Link className="btn-secondary mt-4" to="/listings/new">Create your first listing</Link>
          </section>
        )}

        {!isPending && !isError && activeListings.length > 0 && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isPending={isActionPending}
                isPublishing={publishingListingId === listing.id}
                publishError={publishFailure?.listingId === listing.id ? publishFailure.message : null}
                onRequestAction={requestAction}
                onPublish={() => { void publishListing(listing); }}
              />
            ))}
          </div>
        )}
      </main>
      <ListingActionDialog
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.action === 'unpublish' ? 'Unpublish this listing?' : 'Delete this listing?'}
        description={pendingAction?.action === 'unpublish'
          ? 'This listing will no longer appear in search and new booking requests will stop. Existing bookings are not changed.'
          : 'This listing will be removed from search and marked as deleted. Listings with pending or confirmed bookings cannot be deleted.'}
        confirmLabel={actionFailure?.canRetry ? 'Try again' : actionName}
        pendingLabel={pendingAction?.action === 'unpublish' ? 'Unpublishing...' : 'Deleting...'}
        isPending={isActionPending}
        errorMessage={actionFailure?.message ?? null}
        onCancel={cancelAction}
        onConfirm={() => { void confirmAction(); }}
      />
    </div>
  );
}
