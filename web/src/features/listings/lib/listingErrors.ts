export type ListingErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'deleted'
  | 'active_booking'
  | 'network'
  | 'unknown';

/** Stable listing error contract shared by details and owner listing actions. */
export class ListingError extends Error {
  constructor(
    public readonly code: ListingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ListingError';
  }
}

interface SupabaseLikeError {
  code?: string;
  message?: string;
}

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  return typeof error === 'object' && error !== null;
}

/** Translate backend details without leaking them into user-facing copy. */
export function toListingError(error: unknown): ListingError {
  if (error instanceof ListingError) return error;

  if (error instanceof TypeError) {
    return new ListingError('network', 'The listing service could not be reached.', { cause: error });
  }

  if (isSupabaseLikeError(error)) {
    const code = error.code;
    const message = error.message?.toLowerCase() ?? '';

    if (
      code === '401' ||
      message.includes('must be signed in') ||
      message.includes('not authenticated') ||
      message.includes('authentication required') ||
      message.includes('session missing')
    ) {
      return new ListingError('unauthorized', 'You must be signed in to manage this listing.', { cause: error });
    }
    if (message.includes('already deleted') || message.includes('no longer available')) {
      return new ListingError('deleted', 'This listing is no longer available.', { cause: error });
    }
    if (message.includes('active booking')) {
      return new ListingError('active_booking', 'This listing has an active booking.', { cause: error });
    }
    if (code === 'PGRST116') {
      return new ListingError('not_found', 'The listing could not be found.', { cause: error });
    }
    if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
      return new ListingError('forbidden', 'You do not have permission to perform this listing action.', { cause: error });
    }
  }

  return new ListingError('unknown', 'The listing request could not be completed.', { cause: error });
}

export function listingErrorCode(error: unknown): ListingErrorCode {
  return toListingError(error).code;
}
