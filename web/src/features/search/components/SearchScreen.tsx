import { useTransition } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePublishedListings } from '@/features/listings';
import { EMPTY_SEARCH_CRITERIA, filterPublishedListings, isSameSearch, readSearchCriteria, toSearchParams } from '../lib/searchCriteria';
import type { SearchCriteria } from '../lib/searchCriteria';
import { SearchForm } from './SearchForm';
import { SearchResultCard } from './SearchResultCard';

export function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = readSearchCriteria(searchParams);
  const [isSearchPending, startSearchTransition] = useTransition();
  const {
    data: allPublishedListings = [],
    isError,
    isFetching,
    isPending,
    refetch,
  } = usePublishedListings();
  const listings = filterPublishedListings(allPublishedListings, criteria);
  const hasSearchCriteria = Boolean(criteria.location || criteria.keyword);
  const isActiveSearchLoading = !isPending && (isSearchPending || isFetching);

  const search = (next: SearchCriteria) => {
    const nextParams = toSearchParams(next);
    if (nextParams.toString() === searchParams.toString()) return;
    // The same search reached through a URL with blank or padded values is tidied in place,
    // not added to history as if it were a new search.
    startSearchTransition(() => {
      setSearchParams(nextParams, { replace: isSameSearch(next, criteria) });
    });
  };

  return (
    <main>
      <section className="bg-brand-600 py-12 text-white">
        <div className="page-container">
          <h1 className="mb-2 text-3xl font-bold">Find pet care</h1>
          <p className="mb-6 text-brand-100">Find the right sitter for your pet.</p>
          <SearchForm criteria={criteria} onSearch={search} />
        </div>
      </section>

      <div className="page-container">
        <section aria-labelledby="search-results-heading" aria-busy={isPending || isActiveSearchLoading}>
          <h2 className="sr-only" id="search-results-heading">Listings</h2>
          {isPending && (
            <div className="mt-8" role="status" aria-label="Loading listings">
              <span className="sr-only">Loading listings</span>
              <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((item) => (
                  <li className="h-80 animate-pulse rounded-xl border border-gray-100 bg-gray-200" key={item} />
                ))}
              </ul>
            </div>
          )}

          {!isPending && isError && (
            <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center" role="alert">
              <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">We could not load listings</h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">Check your connection and try again. Your search has not been changed.</p>
              <button className="btn-primary mt-4 inline-flex min-h-11 items-center gap-2" type="button" onClick={() => { void refetch(); }}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </section>
          )}

          {!isPending && !isError && (
            <>
              {isActiveSearchLoading && (
                <p className="mt-6 text-sm text-gray-600" role="status" aria-label="Updating search results" aria-live="polite">Updating search results…</p>
              )}
              {listings.length > 0 ? (
                <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <li key={listing.id}>
                      <SearchResultCard listing={listing} />
                    </li>
                  ))}
                </ul>
              ) : (
                <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center" role="status" aria-label={hasSearchCriteria ? 'No search results' : 'No listings available'}>
                  <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {hasSearchCriteria ? 'No listings match your search' : 'No listings available yet'}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-gray-500">
                    {hasSearchCriteria
                      ? 'Try a different location or keyword, or clear your search.'
                      : 'Published listings will appear here when they are available.'}
                  </p>
                  {hasSearchCriteria && (
                    <button className="btn-secondary mt-4 min-h-11" type="button" onClick={() => search(EMPTY_SEARCH_CRITERIA)}>
                      Clear search
                    </button>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
