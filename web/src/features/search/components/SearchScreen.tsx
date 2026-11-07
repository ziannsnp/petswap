import { useEffect, useTransition } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePublishedListingPage } from '@/features/listings';
import { SEARCH_SORT_OPTIONS, filterPublishedListings, findTidiedSearchParams, isSameSearch, readSearchCriteria, readSearchPage, readSearchSort, toSearchParams } from '../lib/searchCriteria';
import type { SearchCriteria, SearchSort } from '../lib/searchCriteria';
import { SEARCH_FORM_ID, SearchForm } from './SearchForm';
import { SearchResultCard } from './SearchResultCard';

export function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = readSearchCriteria(searchParams);
  const page = readSearchPage(searchParams);
  const [isSearchPending, startSearchTransition] = useTransition();
  const {
    data: listingPage,
    isError,
    isFetching,
    isPending,
    refetch,
  } = usePublishedListingPage({ ...criteria, page });
  const listings = filterPublishedListings(listingPage?.listings ?? [], criteria);
  const totalPages = Math.ceil((listingPage?.totalCount ?? 0) / (listingPage?.pageSize ?? 1));
  const hasSearchCriteria = Boolean(criteria.location || criteria.keyword
    || criteria.petType || criteria.minCapacity || criteria.startDate || criteria.endDate);
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

  useEffect(() => {
    if (!listingPage) return;
    // The address must match what is shown, without adding a history entry.
    const tidied = findTidiedSearchParams(searchParams, listingPage.page);
    if (tidied) setSearchParams(tidied, { replace: true });
  }, [listingPage, searchParams, setSearchParams]);

  const goToPage = (nextPage: number) => {
    setSearchParams(toSearchParams(criteria, nextPage));
  };

  const changeSort = (sort: SearchSort) => {
    if (sort === criteria.sort) return;
    // A new order starts again from page 1; all applied criteria stay in the URL and query.
    startSearchTransition(() => {
      setSearchParams(toSearchParams({ ...criteria, sort }));
    });
  };

  return (
    <main>
      <section className="bg-brand-600 py-12 text-white">
        <div className="page-container">
          <h1 className="mb-2 text-3xl font-bold">Find pet care</h1>
          <p className="mb-6 text-brand-100">Find the right sitter for your pet.</p>
          <SearchForm criteria={criteria} page={page} onSearch={search} />
        </div>
      </section>

      <div className="page-container">
        <section aria-labelledby="search-results-heading" aria-busy={isPending || isActiveSearchLoading}>
          <h2 className="sr-only" id="search-results-heading">Listings</h2>
          {/* Same position in every state so the select stays mounted (and focused) while a sort loads. */}
          {!isError && (isPending || listings.length > 0) && (
            <div className="mt-8 flex items-center justify-end gap-2">
              <label className="text-sm text-gray-700" htmlFor="search-sort">Sort by</label>
              <select
                id="search-sort"
                className="input-field w-auto min-h-11"
                value={criteria.sort}
                onChange={(event) => changeSort(readSearchSort(new URLSearchParams({ sort: event.target.value })))}
              >
                {SEARCH_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

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
                <>
                  <ul className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {listings.map((listing) => (
                      <li key={listing.id}>
                        <SearchResultCard listing={listing} />
                      </li>
                    ))}
                  </ul>
                  {totalPages > 1 && (
                    <nav className="mt-8 flex items-center justify-center gap-4 pb-8" aria-label="Search result pages">
                      <button
                        className="btn-secondary min-h-11"
                        type="button"
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 1}
                      >
                        Previous
                      </button>
                      <p aria-live="polite" className="text-sm text-gray-700">
                        Page {listingPage?.page ?? page} of {totalPages}
                      </p>
                      <button
                        className="btn-secondary min-h-11"
                        type="button"
                        onClick={() => goToPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                      </button>
                    </nav>
                  )}
                </>
              ) : (
                <section className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center" role="status" aria-label={hasSearchCriteria ? 'No search results' : 'No listings available'}>
                  <Home className="h-10 w-10 text-brand-600" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {hasSearchCriteria ? 'No listings match your search' : 'No listings available yet'}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-gray-500">
                    {hasSearchCriteria
                      ? 'Try a different location, keyword, or filter, or clear your search.'
                      : 'Published listings will appear here when they are available.'}
                  </p>
                  {hasSearchCriteria && (
                    <button className="btn-secondary mt-4 min-h-11" type="reset" form={SEARCH_FORM_ID}>
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
