/**
 * The applied search lives in the URL (`/?location=…&keyword=…`) rather than in component
 * state, so a search survives a reload, can be shared as a link, and the back button steps
 * through earlier searches. This module is the only place that knows the parameter names.
 */
export interface SearchCriteria {
  location: string;
  keyword: string;
}

export const EMPTY_SEARCH_CRITERIA: SearchCriteria = { location: '', keyword: '' };

export function readSearchCriteria(params: URLSearchParams): SearchCriteria {
  return {
    location: params.get('location')?.trim() ?? '',
    keyword: params.get('keyword')?.trim() ?? '',
  };
}

/** Blank fields are left out, so an empty search is the plain browse-all URL. */
export function toSearchParams(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams();
  const location = criteria.location.trim();
  const keyword = criteria.keyword.trim();
  if (location) params.set('location', location);
  if (keyword) params.set('keyword', keyword);
  return params;
}

export function isSameSearch(left: SearchCriteria, right: SearchCriteria): boolean {
  return toSearchParams(left).toString() === toSearchParams(right).toString();
}
