/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { usePublishedListings } from '@/features/listings';
import { makeSearchResult } from '../testing/searchFixtures';
import { SearchScreen } from './SearchScreen';

// Only the data hook is replaced. Pet-type labels come from @/shared/lib/petSpecies, which
// is not mocked, so the cards show the same labels as the rest of the app.
jest.mock('@/features/listings', () => ({
  usePublishedListings: jest.fn(),
}));

const mockedUsePublishedListings = jest.mocked(usePublishedListings);
const mockRefetch = jest.fn();

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
  mockedUsePublishedListings.mockReturnValue({
    data: [
      makeSearchResult({ id: 'listing-1', title: 'Sunny garden room' }),
      makeSearchResult({ id: 'listing-2', title: 'Quiet studio with catio', accepted_pet_types: ['cat'] }),
    ],
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: mockRefetch,
  } as unknown as ReturnType<typeof usePublishedListings>);
  mockRefetch.mockReset();
});

describe('SearchScreen', () => {
  it('shows an initial loading state before listings arrive', () => {
    mockedUsePublishedListings.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isFetching: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/');

    expect(screen.getByRole('status', { name: 'Loading listings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Listings' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows an active-search loading state while results are being refreshed', () => {
    mockedUsePublishedListings.mockReturnValue({
      data: [makeSearchResult()],
      isPending: false,
      isError: false,
      isFetching: true,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/?keyword=garden');

    expect(screen.getByRole('status', { name: 'Updating search results' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Listings' })).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a retryable error state when the listings API fails', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListings.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/?keyword=garden');
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load listings');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('shows a browse-all empty state when no published listings exist', () => {
    mockedUsePublishedListings.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/');

    expect(screen.getByRole('status', { name: 'No listings available' })).toHaveTextContent('No listings available yet');
  });

  it('shows a no-results state and clears the applied search', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListings.mockReturnValue({
      data: [makeSearchResult()],
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePublishedListings>);

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

  it('filters results by trimmed, case-insensitive location and keyword', async () => {
    const user = userEvent.setup();
    mockedUsePublishedListings.mockReturnValue({
      data: [
        makeSearchResult({ id: 'chiang-mai', location: 'Chiang Mai, Hang Dong', title: 'Quiet garden home' }),
        makeSearchResult({ id: 'bangkok', location: 'Bangkok', title: 'City studio' }),
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListings>);

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
    mockedUsePublishedListings.mockReturnValue({
      data: [
        makeSearchResult({ id: 'literal', title: '100% safe (indoors)' }),
        makeSearchResult({ id: 'ordinary', title: 'Garden home' }),
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/');
    await user.type(screen.getByLabelText('Keyword'), '%');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(within(results).getByRole('link', { name: '100% safe (indoors)' })).toBeInTheDocument();
  });

  it('never renders a draft or deleted row even if one reaches the search response', () => {
    mockedUsePublishedListings.mockReturnValue({
      data: [
        makeSearchResult({ id: 'published' }),
        makeSearchResult({ id: 'draft', title: 'Private draft', status: 'draft' }),
        makeSearchResult({ id: 'deleted', title: 'Deleted place', status: 'deleted', deleted_at: '2026-10-01T00:00:00.000Z' }),
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePublishedListings>);

    renderSearchAt('/');

    const results = screen.getByRole('region', { name: 'Listings' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(within(results).queryByText('Private draft')).not.toBeInTheDocument();
    expect(within(results).queryByText('Deleted place')).not.toBeInTheDocument();
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
