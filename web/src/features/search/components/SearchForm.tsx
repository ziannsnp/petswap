import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { EMPTY_SEARCH_CRITERIA } from '../lib/searchCriteria';
import type { SearchCriteria } from '../lib/searchCriteria';

interface SearchFormProps {
  /** The search currently applied, as read from the URL. */
  criteria: SearchCriteria;
  onSearch: (criteria: SearchCriteria) => void;
}

export function SearchForm({ criteria, onSearch }: SearchFormProps) {
  const [location, setLocation] = useState(criteria.location);
  const [keyword, setKeyword] = useState(criteria.keyword);
  const [shownCriteria, setShownCriteria] = useState(criteria);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Back and forward change the URL without passing through this form, so the fields
  // follow whichever search is applied. Typing never changes `criteria`, so an unsent
  // draft is only replaced when the visitor moves to a different search.
  if (shownCriteria.location !== criteria.location || shownCriteria.keyword !== criteria.keyword) {
    setShownCriteria(criteria);
    setLocation(criteria.location);
    setKeyword(criteria.keyword);
  }

  const canClear = Boolean(location || keyword || criteria.location || criteria.keyword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = { location: location.trim(), keyword: keyword.trim() };
    setLocation(next.location);
    setKeyword(next.keyword);
    onSearch(next);
  };

  const handleClear = () => {
    setLocation('');
    setKeyword('');
    onSearch(EMPTY_SEARCH_CRITERIA);
    // The Clear button disappears once there is nothing left to clear; without this,
    // keyboard focus would fall back to the page.
    locationInputRef.current?.focus();
  };

  // Escape empties the field being edited, as browsers' own search boxes do. It does
  // not search, so the results only change when the visitor submits.
  const emptyOnEscape = (value: string, empty: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape' || value === '') return;
    event.preventDefault();
    empty();
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-lg md:flex-row"
      role="search"
      aria-label="Search listings"
      onSubmit={handleSubmit}
    >
      <div className="relative flex-1">
        <label className="sr-only" htmlFor="search-location">Location</label>
        <MapPin className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden="true" />
        <input
          id="search-location"
          ref={locationInputRef}
          className="input-field pl-10 text-gray-800"
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Location (e.g. Bangkok, Chiang Mai)"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          onKeyDown={emptyOnEscape(location, () => setLocation(''))}
        />
      </div>
      <div className="relative flex-1">
        <label className="sr-only" htmlFor="search-keyword">Keyword</label>
        <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-gray-400" aria-hidden="true" />
        <input
          id="search-keyword"
          className="input-field pl-10 text-gray-800"
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Keyword (e.g. garden, quiet)"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={emptyOnEscape(keyword, () => setKeyword(''))}
        />
      </div>
      <button className="btn-primary flex min-h-11 items-center justify-center gap-2 md:px-6" type="submit">
        <Search className="h-5 w-5" aria-hidden="true" />
        Search
      </button>
      {canClear && (
        <button className="btn-secondary flex min-h-11 items-center justify-center gap-2" type="button" onClick={handleClear}>
          <X className="h-5 w-5" aria-hidden="true" />
          Clear
        </button>
      )}
    </form>
  );
}
