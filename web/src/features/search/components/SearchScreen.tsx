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
    </main>
  );
}
