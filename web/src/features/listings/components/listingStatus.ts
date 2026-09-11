import type { Listing } from '../lib/listingApi';

export const STATUS_STYLES: Record<Listing['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-50 text-yellow-700' },
  published: { label: 'Published', className: 'bg-green-50 text-green-700' },
  deleted: { label: 'Deleted', className: 'bg-red-50 text-red-700' },
};
