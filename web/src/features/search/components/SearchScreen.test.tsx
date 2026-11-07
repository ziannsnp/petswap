/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { usePublishedListingPage } from '@/features/listings';
import {
  SEARCH_RESULTS_PAGE_SIZE,
  hiddenSearchListings,
  makeSearchPage,
  makeSearchResult,
  pageBoundaryCases,
  paginatedSearchListings,
  searchMatchListings,
  searchPageCases,
} from '../testing/searchFixtures';
import { SearchScreen } from './SearchScreen';

// Only the data hook is replaced. Pet-type labels come from @/shared/lib/petSpecies, which
// is not mocked, so the cards show the same labels as the rest of the app.
jest.mock('@/features/listings', () => ({
  usePublishedListingPage: jest.fn(),
}));

const mockedUsePublishedListingPage = jest.mocked(usePublishedListingPage);
const mockRefetch = jest.fn();

function makePage(listings: ReturnType<typeof makeSearchResult>[], totalCount = listings.length, page = 1) {
  return { listings, totalCount, page, pageSize: 9 };
}

// Shows what the browser would: the URL's query string, how the last navigation happened,
// and a back button.
function BrowserProbe() {
  const { search } = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="url-search">{search}</p>
      <p data-testid="navigation-type">{navigationType}</p>
      <button type="button" onClick={() => navigate(-1)}>Browser back</button>
    </>
  );
}

function renderSearchAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <SearchScreen />
      <BrowserProbe />
    </MemoryRouter>,
  );
}

const urlSearch = () => screen.getByTestId('url-search').textContent;

beforeEach(() => {
  mockedUsePublishedListingPage.mockReturnValue({
    data: makePage([
      makeSearchResult({ id: 'listing-1', title: 'Sunny garden room' }),
      makeSearchResult({ id: 'listing-2', title: 'Quiet studio with catio', accepted_pet_types: ['cat'] }),
    ]),
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof usePublishedListingPage>);
  mockRefetch.mockReset();
});

describe('SearchScreen', () => {
  it('shows an initial loading state before listings arrive', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');

    expect(screen.getByRole('status', { name: 'Loading listings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Listings' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an active-search loading state while results are being refreshed', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([makeSearchResult()]),
      isPending: false,
      isError: false,
      isFetching: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/?keyword=garden');

    expect(screen.getByRole('status', { name: 'Updating search results' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Listings' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a retryable error state when the listings API fails', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/?keyword=garden');
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load listings');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('shows a browse-all empty state when no published listings exist', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([], 0),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');

    expect(screen.getByRole('status', { name: 'No listings available' })).toHaveTextContent('No listings available yet');
  });

  it('shows a no-results state and clears the applied search', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([makeSearchResult()]),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/?keyword=does-not-exist');

    expect(screen.getByRole('status', { name: 'No search results' })).toHaveTextContent('No listings match your search');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(urlSearch()).toBe('');
  });

  it('shows a card for every published listing', () => {
    renderSearchAt('/');

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(2);
    expect(within(results).getByRole('link', { name: 'Sunny garden room' })).toHaveAttribute('href', '/listings/listing-1');
  });

  it('keeps the applied search in the URL when moving between result pages', async () => {
    const user = userEvent.setup();
    const firstPage = makeSearchResult({ id: 'page-one', title: 'Garden home page one', location: 'Bangkok' });
    const secondPage = makeSearchResult({ id: 'page-two', title: 'Garden home page two', location: 'Bangkok' });
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage([page === 1 ? firstPage : secondPage], 10, page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));

    renderSearchAt('/?location=Bangkok&keyword=garden');

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(urlSearch()).toBe('?location=Bangkok&keyword=garden&page=2');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Garden home page two' })).toBeInTheDocument();
  });

  it('resets the page to the first when a new search is submitted', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage([makeSearchResult({ id: `page-${page}` })], 20, page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));

    renderSearchAt('/?location=Bangkok&page=2');
    await user.clear(screen.getByLabelText('Keyword'));
    await user.type(screen.getByLabelText('Keyword'), 'garden');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(urlSearch()).toBe('?location=Bangkok&keyword=garden');
  });

  it('replaces a page beyond the result range with the last available page', async () => {
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage([makeSearchResult({ id: 'last-page' })], 10, page > 2 ? 2 : page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));

    renderSearchAt('/?keyword=garden&page=99');

    await waitFor(() => expect(urlSearch()).toBe('?keyword=garden&page=2'));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('filters results by trimmed, case-insensitive location and keyword', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([
        makeSearchResult({ id: 'chiang-mai', location: 'Chiang Mai, Hang Dong', title: 'Quiet garden home' }),
        makeSearchResult({ id: 'bangkok', location: 'Bangkok', title: 'City studio' }),
      ]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');
    await user.type(screen.getByLabelText('Location'), '  CHIANG mai  ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(within(results).getByRole('link', { name: 'Quiet garden home' })).toBeInTheDocument();
    expect(within(results).queryByRole('link', { name: 'City studio' })).not.toBeInTheDocument();
  });

  it('treats wildcard characters as literal keyword text', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([
        makeSearchResult({ id: 'literal', title: '100% safe (indoors)' }),
        makeSearchResult({ id: 'ordinary', title: 'Garden home' }),
      ]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');
    await user.type(screen.getByLabelText('Keyword'), '%');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(within(results).getByRole('link', { name: '100% safe (indoors)' })).toBeInTheDocument();
  });

  it('never renders a draft or deleted row even if one reaches the search response', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([
        makeSearchResult({ id: 'published' }),
        makeSearchResult({ id: 'draft', title: 'Private draft', status: 'draft' }),
        makeSearchResult({ id: 'deleted', title: 'Deleted place', status: 'deleted', deleted_at: '2026-10-01T00:00:00.000Z' }),
      ]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(within(results).queryByText('Private draft')).not.toBeInTheDocument();
    expect(within(results).queryByText('Deleted place')).not.toBeInTheDocument();
  });

  it('shows only the published matches when hidden listings match the search too', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([...searchMatchListings, ...hiddenSearchListings]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/?keyword=garden');

    const links = within(screen.getByRole('region', { name: 'Listings' })).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName('Sunny Garden Room');
    expect(links[1]).toHaveAccessibleName('Countryside cottage');
  });

  it('shows the no-results state when only a hidden listing matches', () => {
    mockedUsePublishedListingPage.mockReturnValue({
      data: makePage([...searchMatchListings, ...hiddenSearchListings]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/?keyword=suite');

    expect(screen.getByRole('status', { name: 'No search results' })).toBeInTheDocument();
    expect(screen.queryByText('Garden suite (draft)')).not.toBeInTheDocument();
  });

  it('fills the fields from the search in the URL', () => {
    renderSearchAt('/?location=Chiang%20Mai&keyword=garden');

    expect(screen.getByLabelText('Location')).toHaveValue('Chiang Mai');
    expect(screen.getByLabelText('Keyword')).toHaveValue('garden');
  });

  it('puts the trimmed search in the URL when Enter is pressed and keeps focus in the field', async () => {
    const user = userEvent.setup();
    renderSearchAt('/');

    await user.type(screen.getByLabelText('Location'), '  Chiang Mai  ');
    await user.type(screen.getByLabelText('Keyword'), ' garden {Enter}');

    expect(urlSearch()).toBe('?location=Chiang+Mai&keyword=garden');
    expect(screen.getByLabelText('Location')).toHaveValue('Chiang Mai');
    expect(screen.getByLabelText('Keyword')).toHaveFocus();
  });

  it('leaves a blank field out of the URL', async () => {
    const user = userEvent.setup();
    renderSearchAt('/');

    await user.type(screen.getByLabelText('Location'), 'Bangkok');
    await user.type(screen.getByLabelText('Keyword'), '   ');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(urlSearch()).toBe('?location=Bangkok');
  });

  it('does not add a history entry when the applied search is submitted again', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=Bangkok');

    await user.type(screen.getByLabelText('Location'), ' {Enter}');

    expect(screen.getByTestId('navigation-type')).toHaveTextContent('POP');
    expect(screen.getByLabelText('Location')).toHaveValue('Bangkok');
  });

  it('tidies a URL with a blank or padded value when the same search is submitted', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=%20Bangkok&keyword=');

    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(urlSearch()).toBe('?location=Bangkok');
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE');
  });

  it('clears both fields and the URL, then returns focus to the location field', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=Bangkok&keyword=cat');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(urlSearch()).toBe('');
    expect(screen.getByLabelText('Location')).toHaveValue('');
    expect(screen.getByLabelText('Keyword')).toHaveValue('');
    expect(screen.getByLabelText('Location')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('empties only the field being edited on Escape, without searching', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=Bangkok&keyword=cat');

    await user.click(screen.getByLabelText('Keyword'));
    await user.keyboard('{Escape}');

    expect(screen.getByLabelText('Keyword')).toHaveValue('');
    expect(screen.getByLabelText('Location')).toHaveValue('Bangkok');
    expect(urlSearch()).toBe('?location=Bangkok&keyword=cat');
  });

  it('shows the earlier search again when the visitor goes back', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=Bangkok');

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Chiang Mai{Enter}');
    expect(urlSearch()).toBe('?location=Chiang+Mai');

    await user.click(screen.getByRole('button', { name: 'Browser back' }));

    expect(urlSearch()).toBe('?location=Bangkok');
    expect(screen.getByLabelText('Location')).toHaveValue('Bangkok');
  });
});

describe('SearchScreen pagination fixtures', () => {
  // Serves every requested page from the fixture listings, resolved like the search RPC.
  function servePagesOf(listings: typeof paginatedSearchListings) {
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makeSearchPage(listings, page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));
  }

  const shownIds = () => within(screen.getByRole('region', { name: 'Listings' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('href')?.replace('/listings/', ''));

  it.each(searchPageCases)('shows $name', async ({ requestedPage, expectedPage, expectedIds }) => {
    servePagesOf(paginatedSearchListings);

    renderSearchAt(`/?page=${requestedPage}`);

    expect(shownIds()).toEqual(expectedIds);
    expect(screen.getByText(`Page ${expectedPage} of 3`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty('disabled', expectedPage === 1);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', expectedPage === 3);
    await waitFor(() => expect(urlSearch()).toBe(expectedPage === 1 ? '' : `?page=${expectedPage}`));
  });

  it.each(pageBoundaryCases)('$name', ({ listings, pageLabel }) => {
    servePagesOf(listings);

    renderSearchAt('/');

    expect(shownIds()).toHaveLength(Math.min(listings.length, SEARCH_RESULTS_PAGE_SIZE));
    expect(screen.queryByText(/^Page \d+ of \d+$/)?.textContent ?? null).toBe(pageLabel);
  });

  it('steps forward to the last page and back again without losing the search', async () => {
    const user = userEvent.setup();
    servePagesOf(paginatedSearchListings);

    renderSearchAt('/?keyword=paged');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(urlSearch()).toBe('?keyword=paged&page=3');
    expect(shownIds()).toEqual(['paged-02', 'paged-01']);

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(urlSearch()).toBe('?keyword=paged&page=2');
    expect(shownIds()).toHaveLength(SEARCH_RESULTS_PAGE_SIZE);
  });
});

describe('SearchScreen sort and reset', () => {
  function servePages(totalCount = 20) {
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage([makeSearchResult({ id: `result-${page}`, title: 'Garden home', location: 'Bangkok' })], totalCount, page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));
  }

  const lastQuery = () => mockedUsePublishedListingPage.mock.calls.at(-1)?.[0];

  it('requests newest first by default and lists every sort option', () => {
    servePages();

    renderSearchAt('/');

    expect(lastQuery()).toMatchObject({ sort: 'newest', page: 1 });
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
    expect(within(screen.getByLabelText('Sort by')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Newest', 'Oldest', 'Title (A–Z)', 'Capacity (high to low)']);
  });

  it('keeps the sort control mounted and focused while an uncached sort loads', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockImplementation(({ sort }) => (sort === 'title'
      ? { data: undefined, isPending: true, isError: false, isFetching: true, refetch: mockRefetch }
      : { data: makePage([makeSearchResult({ id: 'result-1' })]), isPending: false, isError: false, isFetching: false, refetch: mockRefetch }
    ) as unknown as ReturnType<typeof usePublishedListingPage>);

    renderSearchAt('/');
    const select = screen.getByLabelText('Sort by');
    await user.selectOptions(select, 'title');

    expect(screen.getByRole('status', { name: 'Loading listings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toBe(select);
    expect(select).toHaveFocus();
  });

  it('applies the chosen sort to the search and returns to the first page', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/?location=Bangkok&keyword=garden&page=2');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');

    expect(urlSearch()).toBe('?location=Bangkok&keyword=garden&sort=title');
    expect(lastQuery()).toEqual({ location: 'Bangkok', keyword: 'garden', sort: 'title', page: 1 });
    expect(screen.getByLabelText('Sort by')).toHaveValue('title');
  });

  it('keeps the sort and the search while moving between pages', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/?keyword=garden&sort=capacity');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(urlSearch()).toBe('?keyword=garden&sort=capacity&page=2');
    expect(lastQuery()).toEqual({ location: '', keyword: 'garden', sort: 'capacity', page: 2 });
  });

  it('keeps the sort when a new search is submitted from a later page', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/?sort=oldest&page=2');
    await user.type(screen.getByLabelText('Keyword'), 'garden{Enter}');

    expect(urlSearch()).toBe('?keyword=garden&sort=oldest');
  });

  it('keeps the sort when the last page replaces a page beyond the range', async () => {
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage([makeSearchResult({ id: 'last-page' })], 10, page > 2 ? 2 : page),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));

    renderSearchAt('/?keyword=garden&sort=title&page=99');

    await waitFor(() => expect(urlSearch()).toBe('?keyword=garden&sort=title&page=2'));
  });

  it('falls back to newest and tidies the URL for an unknown or default sort', async () => {
    servePages(5);

    renderSearchAt('/?sort=price');
    await waitFor(() => expect(urlSearch()).toBe(''));
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  });

  it('resets the sort, the search, and the page together with Clear', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/?location=Bangkok&keyword=garden&sort=title&page=2');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(urlSearch()).toBe('');
    expect(lastQuery()).toEqual({ location: '', keyword: '', sort: 'newest', page: 1 });
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('offers Clear when only the sort differs from the default', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Sort by'), 'oldest');
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(urlSearch()).toBe('');
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  });

  it('resets the sort from the no-results state and shows the default listings again', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListingPage.mockImplementation(({ keyword }) => ({
      data: keyword ? makePage([], 0) : makePage([makeSearchResult({ id: 'default-listing', title: 'Default listing' })]),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));

    renderSearchAt('/?keyword=nothing&sort=title');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(urlSearch()).toBe('');
    expect(screen.getByRole('link', { name: 'Default listing' })).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ sort: 'newest' });
  });

  it('steps back to the previous order with the browser back button', async () => {
    const user = userEvent.setup();
    servePages();

    renderSearchAt('/?keyword=garden');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');
    await user.click(screen.getByRole('button', { name: 'Browser back' }));

    expect(urlSearch()).toBe('?keyword=garden');
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  });
});

describe('SearchScreen filters', () => {
  const fullUrl = '?location=Bangkok&petType=cat&minCapacity=3&startDate=2026-12-01&endDate=2026-12-05&sort=title';

  function servePages(totalCount = 20) {
    mockedUsePublishedListingPage.mockImplementation(({ page }) => ({
      data: makePage(
        [makeSearchResult({ id: `result-${page}`, title: 'Garden home', location: 'Bangkok' })],
        totalCount,
        Math.min(page, Math.ceil(totalCount / 9)),
      ),
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListingPage>));
  }

  const petType = () => screen.getByLabelText('Pet type');
  const minCapacity = () => screen.getByLabelText('Minimum capacity');
  const startDate = () => screen.getByLabelText('Start date');
  const endDate = () => screen.getByLabelText('End date');
  const setDates = (start: string, end: string) => {
    fireEvent.change(startDate(), { target: { value: start } });
    fireEvent.change(endDate(), { target: { value: end } });
  };
  const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Search' }));

  beforeEach(() => servePages());

  it('offers every pet type, a choice of capacities, and two dates in the search form', () => {
    renderSearchAt('/');

    const form = within(screen.getByRole('search', { name: 'Search listings' }));
    expect(within(form.getByLabelText('Pet type')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['All pet types', 'Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea pig', 'Fish', 'Reptile', 'Exotic mammal', 'Bird', 'Other']);
    expect(within(form.getByLabelText('Minimum capacity')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Any capacity', '2+ pets', '3+ pets', '4+ pets', '5+ pets', '6+ pets', '7+ pets', '8+ pets', '9+ pets', '10+ pets']);
    expect(form.getByLabelText('Start date')).toHaveAttribute('type', 'date');
    expect(form.getByLabelText('End date')).toHaveAttribute('type', 'date');
  });

  it('fills the controls from the URL', () => {
    renderSearchAt(`/${fullUrl}`);

    expect(petType()).toHaveValue('cat');
    expect(minCapacity()).toHaveValue('3');
    expect(startDate()).toHaveValue('2026-12-01');
    expect(endDate()).toHaveValue('2026-12-05');
    expect(endDate()).toHaveAttribute('min', '2026-12-01');
  });

  it('applies nothing until the search is submitted', async () => {
    const user = userEvent.setup();
    renderSearchAt('/');

    await user.selectOptions(petType(), 'cat');
    await user.selectOptions(minCapacity(), '3');
    setDates('2026-12-01', '2026-12-05');

    expect(urlSearch()).toBe('');
  });

  it('applies the filters with the search and the sort, and returns to the first page', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?location=Bangkok&sort=title&page=2');

    await user.selectOptions(petType(), 'cat');
    await user.selectOptions(minCapacity(), '3');
    setDates('2026-12-01', '2026-12-05');
    await submit(user);

    expect(urlSearch()).toBe(fullUrl);
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('PUSH');
  });

  it('keeps everything else when one filter is changed', async () => {
    const user = userEvent.setup();
    renderSearchAt(`/${fullUrl}`);

    await user.selectOptions(petType(), 'dog');
    await submit(user);

    expect(urlSearch()).toBe(fullUrl.replace('petType=cat', 'petType=dog'));
  });

  it('keeps everything else when one filter is removed', async () => {
    const user = userEvent.setup();
    renderSearchAt(`/${fullUrl}`);

    await user.selectOptions(minCapacity(), '');
    await submit(user);

    expect(urlSearch()).toBe(fullUrl.replace('&minCapacity=3', ''));
  });

  it('removes the date filter when both dates are emptied', async () => {
    const user = userEvent.setup();
    renderSearchAt(`/${fullUrl}`);

    setDates('', '');
    await submit(user);

    expect(urlSearch()).toBe('?location=Bangkok&petType=cat&minCapacity=3&sort=title');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['ends before it starts', '2026-12-05', '2026-12-01', 'End date', 'End date must be later than the start date.'],
    ['ends on the day it starts', '2026-12-05', '2026-12-05', 'End date', 'End date must be later than the start date.'],
    ['has only a start date', '2026-12-05', '', 'End date', 'Choose both a start date and an end date.'],
    ['has only an end date', '', '2026-12-05', 'Start date', 'Choose both a start date and an end date.'],
  ])('shows an error and applies nothing when the range %s', async (_name, start, end, field, message) => {
    const user = userEvent.setup();
    renderSearchAt('/?keyword=garden');

    await user.clear(screen.getByLabelText('Keyword'));
    await user.type(screen.getByLabelText('Keyword'), 'quiet');
    await user.selectOptions(petType(), 'cat');
    setDates(start, end);
    await submit(user);

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(urlSearch()).toBe('?keyword=garden');
    expect(screen.getByLabelText(field)).toHaveFocus();
    expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message);
    expect(screen.getByLabelText('Keyword')).toHaveValue('quiet');
    expect(petType()).toHaveValue('cat');
  });

  it('keeps the applied range and the entered dates while a bad range is corrected', async () => {
    const user = userEvent.setup();
    renderSearchAt(`/${fullUrl}`);

    setDates('2026-12-10', '2026-12-08');
    await submit(user);

    expect(urlSearch()).toBe(fullUrl);
    expect(startDate()).toHaveValue('2026-12-10');
    expect(endDate()).toHaveValue('2026-12-08');

    fireEvent.change(endDate(), { target: { value: '2026-12-12' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(endDate()).toHaveAttribute('aria-invalid', 'false');

    await submit(user);

    expect(urlSearch()).toBe(fullUrl.replace('2026-12-01', '2026-12-10').replace('2026-12-05', '2026-12-12'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the filters when the sort changes, and an unsent filter stays unsent', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?petType=cat');

    await user.selectOptions(minCapacity(), '4');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');

    expect(urlSearch()).toBe('?petType=cat&sort=title');
    expect(minCapacity()).toHaveValue('4');
  });

  it('keeps the filters while moving between pages', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?petType=cat&minCapacity=3');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(urlSearch()).toBe('?petType=cat&minCapacity=3&page=2');
  });

  it('keeps the filters when the last page replaces a page beyond the range', async () => {
    renderSearchAt('/?petType=cat&startDate=2026-12-01&endDate=2026-12-05&page=99');

    await waitFor(() => expect(urlSearch()).toBe('?petType=cat&startDate=2026-12-01&endDate=2026-12-05&page=3'));
  });

  it('tidies invalid filters out of the URL and keeps the valid ones', async () => {
    renderSearchAt('/?keyword=cat&petType=dragon&minCapacity=3&startDate=2026-12-05&endDate=2026-12-01');

    await waitFor(() => expect(urlSearch()).toBe('?keyword=cat&minCapacity=3'));
    expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE');
    expect(petType()).toHaveValue('');
    expect(minCapacity()).toHaveValue('3');
    expect(startDate()).toHaveValue('');
    expect(endDate()).toHaveValue('');
  });

  it('clears the filters and any date error with the rest of the search', async () => {
    const user = userEvent.setup();
    renderSearchAt(`/${fullUrl}`);

    setDates('2026-12-10', '2026-12-08');
    await submit(user);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(urlSearch()).toBe('');
    expect(petType()).toHaveValue('');
    expect(minCapacity()).toHaveValue('');
    expect(startDate()).toHaveValue('');
    expect(endDate()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('empties filters and a date error that were never applied', async () => {
    const user = userEvent.setup();
    renderSearchAt('/');

    await user.selectOptions(petType(), 'cat');
    setDates('2026-12-10', '2026-12-08');
    await submit(user);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(petType()).toHaveValue('');
    expect(startDate()).toHaveValue('');
    expect(endDate()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers Clear for a filter that is only chosen, or only applied', async () => {
    const user = userEvent.setup();
    renderSearchAt('/');

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    await user.selectOptions(petType(), 'cat');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    await submit(user);
    await user.selectOptions(petType(), '');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('shows the earlier filters again when the visitor goes back', async () => {
    const user = userEvent.setup();
    renderSearchAt('/?petType=cat');

    await user.selectOptions(petType(), 'dog');
    setDates('2026-12-01', '2026-12-05');
    await submit(user);
    await user.click(screen.getByRole('button', { name: 'Browser back' }));

    expect(urlSearch()).toBe('?petType=cat');
    expect(petType()).toHaveValue('cat');
    expect(startDate()).toHaveValue('');
    expect(endDate()).toHaveValue('');
  });
});
