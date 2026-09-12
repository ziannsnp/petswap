import type { Listing } from './listingApi';

/** Label and badge colour for each listing status, shared by every screen that shows one. */
export const LISTING_STATUS_STYLES: Record<Listing['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-50 text-yellow-700' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700' },
  deleted: { label: 'Deleted', className: 'bg-red-50 text-red-700' },
};
