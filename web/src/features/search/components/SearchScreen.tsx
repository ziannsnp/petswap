<<<<<<< HEAD
import { useSearchParams } from 'react-router-dom';
import { usePublishedListings } from '@/features/listings';
import {
  changeQuery, changeSort, DEFAULT_CRITERIA, getResultsPage, parsePage, parseSort, resetCriteria,
  type SearchCriteria, type SortOption,
} from '../lib/searchResults';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  title: 'Title (A–Z)',
  capacity: 'Capacity (high to low)',
};

function toParams(criteria: SearchCriteria): Record<string, string> {
  const params: Record<string, string> = {};
  if (criteria.query) params.q = criteria.query;
  if (criteria.sort !== DEFAULT_CRITERIA.sort) params.sort = criteria.sort;
  if (criteria.page > 1) params.page = String(criteria.page);
  return params;
}

export function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, error } = usePublishedListings();

  const criteria: SearchCriteria = {
    query: searchParams.get('q') ?? '',
    sort: parseSort(searchParams.get('sort')),
    page: parsePage(searchParams.get('page')),
  };
  const update = (next: SearchCriteria) => setSearchParams(toParams(next));

  const results = getResultsPage(data ?? [], criteria);
  const isDefault = !criteria.query && criteria.sort === DEFAULT_CRITERIA.sort && criteria.page === 1;

  return (
    <main className="placeholder-screen">
      <p className="eyebrow">Don't Like My Pets</p>
      <h1>Find pet care</h1>

      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label>
          Location or keyword
          <input
            type="search"
            value={criteria.query}
            onChange={(event) => update(changeQuery(criteria, event.target.value))}
          />
        </label>
        <label>
          Sort by
          <select
            value={criteria.sort}
            onChange={(event) => update(changeSort(criteria, parseSort(event.target.value)))}
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={isDefault} onClick={() => update(resetCriteria())}>
          Reset
        </button>
      </form>

      {isLoading && <p>Loading listings…</p>}
      {error && <p role="alert">Could not load listings. Please try again.</p>}
      {!isLoading && !error && results.totalItems === 0 && (
        <p>No listings match your search. Reset to see all published listings.</p>
      )}

      <ul>
        {results.items.map((listing) => (
          <li key={listing.id}>
            <h2>{listing.title}</h2>
            <p>{listing.location} · up to {listing.capacity} pets</p>
          </li>
        ))}
      </ul>

      {results.totalItems > 0 && (
        <nav aria-label="Pagination">
          <button
            type="button"
            disabled={results.page <= 1}
            onClick={() => update({ ...criteria, page: results.page - 1 })}
          >
            Previous
          </button>
          <span> Page {results.page} of {results.totalPages} </span>
          <button
            type="button"
            disabled={results.page >= results.totalPages}
            onClick={() => update({ ...criteria, page: results.page + 1 })}
          >
            Next
          </button>
        </nav>
      )}
=======
import { useEffect, useTransition } from 'react';
import { Home, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { usePublishedListingPage } from '@/features/listings';
import { EMPTY_SEARCH_CRITERIA, filterPublishedListings, isSameSearch, readSearchCriteria, readSearchPage, toSearchParams } from '../lib/searchCriteria';
import type { SearchCriteria } from '../lib/searchCriteria';
import { SearchForm } from './SearchForm';
import { SearchResultCard } from './SearchResultCard';

export function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = readSearchCriteria(searchParams);
  const page = readSearchPage(searchParams);
  const pageParam = searchParams.get('page');
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

  useEffect(() => {
    if (!listingPage) return;
    const resolvedPage = listingPage.page;
    const shouldNormalizeUrl = resolvedPage !== page
      || (pageParam !== null && (page === 1 || pageParam !== String(page)));
    if (!shouldNormalizeUrl) return;
    setSearchParams(toSearchParams({
      location: criteria.location,
      keyword: criteria.keyword,
    }, resolvedPage), { replace: true });
  }, [criteria.keyword, criteria.location, listingPage, page, pageParam, setSearchParams]);

  const goToPage = (nextPage: number) => {
    setSearchParams(toSearchParams(criteria, nextPage));
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
                <>
                  <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
>>>>>>> origin/main
    </main>
  );
}
