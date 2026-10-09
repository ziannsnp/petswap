import { useSearchParams } from 'react-router-dom';
import { usePublishedListings } from '@/features/listings';
import { isSameSearch, readSearchCriteria, toSearchParams } from '../lib/searchCriteria';
import type { SearchCriteria } from '../lib/searchCriteria';
import { SearchForm } from './SearchForm';
import { SearchResultCard } from './SearchResultCard';

export function SearchScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = readSearchCriteria(searchParams);
  // TODO(5.1.3, 5.1.4): query by `criteria` once the search API exists. Until then every
  // published listing is shown, whatever was searched for.
  const { data: listings = [], isPending } = usePublishedListings();

  const search = (next: SearchCriteria) => {
    const nextParams = toSearchParams(next);
    if (nextParams.toString() === searchParams.toString()) return;
    // The same search reached through a URL with blank or padded values is tidied in place,
    // not added to history as if it were a new search.
    setSearchParams(nextParams, { replace: isSameSearch(next, criteria) });
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
        <section aria-labelledby="search-results-heading" aria-busy={isPending}>
          <h2 className="sr-only" id="search-results-heading">Listings</h2>
          {/* TODO(5.1.7, 5.1.8): loading, browse-all, no-results, error, and retry states. */}
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <SearchResultCard listing={listing} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
