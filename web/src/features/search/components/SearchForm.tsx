import { useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { PET_SPECIES_OPTIONS } from '@/shared/lib/petSpecies';
import {
  EMPTY_SEARCH_CRITERIA,
  SEARCH_MIN_CAPACITY_OPTIONS,
  earliestSearchEndDate,
  findSearchDateError,
  isSameSearch,
  readSearchFilters,
  toSearchFilterDraft,
  todaySearchDate,
} from '../lib/searchCriteria';
import type { SearchCriteria, SearchDateError, SearchFilterDraft } from '../lib/searchCriteria';

// On a phone the filters sit two to a row, so their side padding shrinks to leave room for
// the longest option ("Exotic mammal") and the date format.
const FILTER_SELECT_CLASS = 'input-field h-12 pl-2 pr-1 text-gray-800 sm:px-4';
const FILTER_DATE_CLASS = 'input-field h-12 px-2 text-gray-800 sm:px-4';

interface SearchFormProps {
  /** The search currently applied, as read from the URL. */
  criteria: SearchCriteria;
  page: number;
  onSearch: (criteria: SearchCriteria) => void;
}

export const SEARCH_FORM_ID = 'listing-search-form';

export function SearchForm({ criteria, page, onSearch }: SearchFormProps) {
  const [location, setLocation] = useState(criteria.location);
  const [keyword, setKeyword] = useState(criteria.keyword);
  const [filters, setFilters] = useState(() => toSearchFilterDraft(criteria));
  const [dateError, setDateError] = useState<SearchDateError | null>(null);
  const [shownCriteria, setShownCriteria] = useState(criteria);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  // Back and forward change the URL without passing through this form, so the fields
  // follow whichever search is applied. Typing never changes `criteria`, and the sort is
  // applied from the results toolbar, so an unsent draft is only replaced when the visitor
  // moves to a different search.
  if (!isSameSearch({ ...shownCriteria, sort: criteria.sort }, criteria)) {
    setShownCriteria(criteria);
    setLocation(criteria.location);
    setKeyword(criteria.keyword);
    setFilters(toSearchFilterDraft(criteria));
    setDateError(null);
  }

  // Read on every render, so a page left open past midnight moves on to the new day.
  const today = todaySearchDate();

  // The sort is applied from the results toolbar, so a clear must reset it too.
  const canClear = Boolean(location || keyword || Object.values(filters).some(Boolean))
    || !isSameSearch(criteria, EMPTY_SEARCH_CRITERIA) || page > 1;

  const changeFilter = (name: keyof SearchFilterDraft, value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const changeDate = (name: 'startDate' | 'endDate', value: string) => {
    setDateError(null);
    changeFilter(name, value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = findSearchDateError(filters.startDate, filters.endDate, today);
    setDateError(error);
    if (error) {
      // Nothing is applied, so what is showing in the results stays as it was.
      (error.field === 'startDate' ? startDateInputRef : endDateInputRef).current?.focus();
      return;
    }
    const next = {
      location: location.trim(),
      keyword: keyword.trim(),
      ...readSearchFilters(new URLSearchParams(filters), today),
      sort: criteria.sort,
    };
    setLocation(next.location);
    setKeyword(next.keyword);
    onSearch(next);
  };

  const handleClear = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocation('');
    setKeyword('');
    setFilters(toSearchFilterDraft(EMPTY_SEARCH_CRITERIA));
    setDateError(null);
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
      id={SEARCH_FORM_ID}
      className="space-y-3 rounded-xl bg-white p-4 shadow-lg"
      role="search"
      aria-label="Search listings"
      onSubmit={handleSubmit}
      onReset={handleClear}
      noValidate
    >
      <div className="flex flex-col gap-3 md:flex-row">
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
      </div>

      <fieldset>
        <legend className="sr-only">Filters</legend>
        {/* Two columns from 360px keep the form short on a phone; narrower screens cannot fit two. */}
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label" htmlFor="search-pet-type">Pet type</label>
            <select
              id="search-pet-type"
              className={FILTER_SELECT_CLASS}
              value={filters.petType}
              onChange={(event) => changeFilter('petType', event.target.value)}
            >
              <option value="">All pet types</option>
              {PET_SPECIES_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="search-min-capacity">Minimum capacity</label>
            <select
              id="search-min-capacity"
              className={FILTER_SELECT_CLASS}
              value={filters.minCapacity}
              onChange={(event) => changeFilter('minCapacity', event.target.value)}
            >
              <option value="">Any capacity</option>
              {SEARCH_MIN_CAPACITY_OPTIONS.map((capacity) => (
                <option key={capacity} value={capacity}>{capacity}+ pets</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="search-start-date">Start date</label>
            <input
              id="search-start-date"
              ref={startDateInputRef}
              className={`${FILTER_DATE_CLASS} ${dateError?.field === 'startDate' ? 'input-field--error' : ''}`}
              type="date"
              min={today}
              value={filters.startDate}
              onChange={(event) => changeDate('startDate', event.target.value)}
              aria-invalid={dateError?.field === 'startDate'}
              aria-describedby={dateError?.field === 'startDate' ? 'search-date-error' : undefined}
            />
            {dateError?.field === 'startDate' && (
              <p className="form-error" id="search-date-error" role="alert">{dateError.message}</p>
            )}
          </div>
          <div>
            <label className="form-label" htmlFor="search-end-date">End date</label>
            <input
              id="search-end-date"
              ref={endDateInputRef}
              className={`${FILTER_DATE_CLASS} ${dateError?.field === 'endDate' ? 'input-field--error' : ''}`}
              type="date"
              min={earliestSearchEndDate(filters.startDate, today)}
              value={filters.endDate}
              onChange={(event) => changeDate('endDate', event.target.value)}
              aria-invalid={dateError?.field === 'endDate'}
              aria-describedby={dateError?.field === 'endDate' ? 'search-date-error' : undefined}
            />
            {dateError?.field === 'endDate' && (
              <p className="form-error" id="search-date-error" role="alert">{dateError.message}</p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 md:flex-row md:justify-end">
        {canClear && (
          <button className="btn-secondary flex min-h-11 items-center justify-center gap-2" type="reset">
            <X className="h-5 w-5" aria-hidden="true" />
            Clear
          </button>
        )}
        <button className="btn-primary flex min-h-11 items-center justify-center gap-2 md:px-6" type="submit">
          <Search className="h-5 w-5" aria-hidden="true" />
          Search
        </button>
      </div>
    </form>
  );
}
