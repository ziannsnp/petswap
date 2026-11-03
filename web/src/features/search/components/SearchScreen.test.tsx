/** @jest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
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
