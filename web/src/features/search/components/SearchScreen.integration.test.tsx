/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '@/shared/lib/supabase';
import type { Listing } from '@/features/listings';
import { makeSearchResult } from '../testing/searchFixtures';
import { SearchScreen } from './SearchScreen';

// Exercise the real screen, query cache, hook, and adapter. Only the Supabase
// boundary is replaced; SQL checks verify how the server orders and filters rows.
jest.mock('@/shared/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }));

const rpc = jest.fn();
const clients: QueryClient[] = [];

function BrowserProbe() {
  const { search } = useLocation();
  const navigate = useNavigate();
  return <>
    <p data-testid="url-search">{search}</p>
    <button type="button" onClick={() => navigate(-1)}>Browser back</button>
  </>;
}

function renderSearch(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 0 } },
  });
  clients.push(client);
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[url]}><SearchScreen /><BrowserProbe /></MemoryRouter>
  </QueryClientProvider>);
}

function rows(listings: Listing[], page = 1, totalCount = listings.length) {
  return { data: listings.map((listing) => ({ ...listing, page_number: page, total_count: totalCount })), error: null };
}

const result = (id: string, title: string) => makeSearchResult({
  id, title, location: 'Bangkok', capacity: 4, accepted_pet_types: ['cat', 'dog'],
});
const lastArgs = () => rpc.mock.calls.at(-1)?.[1];
const urlSearch = () => screen.getByTestId('url-search').textContent;
const shownTitles = () => within(screen.getByRole('region', { name: 'Listings' }))
  .getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

beforeEach(() => {
  rpc.mockReset();
  const orderById = jest.fn().mockResolvedValue({ data: [], error: null });
  const orderByPosition = jest.fn().mockReturnValue({ order: orderById });
  const from = jest.fn().mockReturnValue({
    select: () => ({ in: () => ({ order: orderByPosition }) }),
  });
  jest.mocked(getSupabaseClient).mockReturnValue({ rpc, from } as never);
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

it('renders server sorting across pages with all criteria retained, then resets to default listings', async () => {
  const user = userEvent.setup();
  const titlePage = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India']
    .map((name) => result(name, `${name} garden`));
  rpc.mockImplementation(async (_name, args) => {
    if (args.p_sort === 'oldest' && args.p_page === 2) return rows([result('tail', 'Tail garden')], 2, 10);
    if (args.p_sort === 'title' && args.p_page === 1) return rows(titlePage, 1, 10);
    if (args.p_sort === 'title' && args.p_page === 2) return rows([result('zulu', 'Zulu garden')], 2, 10);
    if (args.p_sort === 'newest' && !args.p_pet_type) return rows([result('default', 'Newest home')]);
    throw new Error('Unexpected search request');
  });
  const filters = {
    p_location: 'Bangkok', p_keyword: 'garden', p_pet_type: 'cat', p_min_capacity: 3,
    p_start_date: '2026-12-01', p_end_date: '2026-12-05', p_page_size: 9,
  };
  const criteria = 'location=Bangkok&keyword=garden&petType=cat&minCapacity=3&startDate=2026-12-01&endDate=2026-12-05';
  renderSearch(`/?${criteria}&sort=oldest&page=2`);
  await screen.findByRole('link', { name: 'Tail garden' });
  expect(lastArgs()).toEqual({ ...filters, p_sort: 'oldest', p_page: 2 });

  const select = screen.getByLabelText('Sort by');
  await user.selectOptions(select, 'title');
  await screen.findByRole('link', { name: 'Alpha garden' });
  expect(shownTitles()).toEqual(titlePage.map((listing) => listing.title));
  expect(lastArgs()).toEqual({ ...filters, p_sort: 'title', p_page: 1 });
  expect(urlSearch()).toBe(`?${criteria}&sort=title`);
  expect(screen.getByLabelText('Sort by')).toBe(select);
  expect(select).toHaveFocus();

  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('link', { name: 'Zulu garden' });
  expect(shownTitles()).toEqual(['Zulu garden']);
  expect(lastArgs()).toEqual({ ...filters, p_sort: 'title', p_page: 2 });
  expect(urlSearch()).toBe(`?${criteria}&sort=title&page=2`);

  await user.click(screen.getByRole('button', { name: 'Clear' }));
  await screen.findByRole('link', { name: 'Newest home' });
  expect(lastArgs()).toEqual({ p_location: '', p_keyword: '', p_page: 1, p_page_size: 9, p_sort: 'newest' });
  expect(urlSearch()).toBe('');
  expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  expect(screen.getByLabelText('Pet type')).toHaveValue('');
  expect(screen.getByLabelText('Minimum capacity')).toHaveValue('');
  expect(screen.getByLabelText('Start date')).toHaveValue('');
  expect(screen.getByLabelText('End date')).toHaveValue('');
  expect(screen.getByLabelText('Location')).toHaveValue('');
  expect(screen.getByLabelText('Keyword')).toHaveValue('');
  expect(screen.getByLabelText('Location')).toHaveFocus();
  expect(screen.queryByRole('navigation', { name: 'Search result pages' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Browser back' }));
  await screen.findByRole('link', { name: 'Zulu garden' });
  expect(urlSearch()).toBe(`?${criteria}&sort=title&page=2`);
  expect(screen.getByLabelText('Pet type')).toHaveValue('cat');
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-12-01');
  expect(screen.getByLabelText('Sort by')).toHaveValue('title');
});

it('keeps drafts while sorting, fetches changed filters, and resets a filtered empty state and date error', async () => {
  const user = userEvent.setup();
  rpc.mockImplementation(async (_name, args) => {
    if (args.p_pet_type === 'dog') return rows([]);
    if (args.p_pet_type === 'cat') return rows([result('cat', args.p_sort === 'title' ? 'Cat garden' : 'Large cat home')]);
    return rows([result('default', 'Newest home')]);
  });
  renderSearch('/?petType=cat&sort=title');
  await screen.findByRole('link', { name: 'Cat garden' });

  await user.selectOptions(screen.getByLabelText('Pet type'), 'dog');
  await user.selectOptions(screen.getByLabelText('Minimum capacity'), '4');
  await user.selectOptions(screen.getByLabelText('Sort by'), 'capacity');
  await screen.findByRole('link', { name: 'Large cat home' });
  expect(lastArgs()).toEqual({
    p_location: '', p_keyword: '', p_page: 1, p_page_size: 9, p_sort: 'capacity', p_pet_type: 'cat',
  });
  expect(screen.getByLabelText('Pet type')).toHaveValue('dog');
  expect(screen.getByLabelText('Minimum capacity')).toHaveValue('4');

  await user.click(screen.getByRole('button', { name: /^Search$/ }));
  expect(await screen.findByRole('status', { name: 'No search results' })).toHaveTextContent('No listings match your search');
  expect(lastArgs()).toEqual({
    p_location: '', p_keyword: '', p_page: 1, p_page_size: 9,
    p_sort: 'capacity', p_pet_type: 'dog', p_min_capacity: 4,
  });
  expect(screen.queryByRole('link', { name: 'Large cat home' })).not.toBeInTheDocument();
  expect(urlSearch()).toBe('?petType=dog&minCapacity=4&sort=capacity');

  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-10' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-12-08' } });
  const requestCount = rpc.mock.calls.length;
  await user.click(screen.getByRole('button', { name: /^Search$/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('End date must be later than the start date.');
  expect(rpc).toHaveBeenCalledTimes(requestCount);

  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  await screen.findByRole('link', { name: 'Newest home' });
  expect(urlSearch()).toBe('');
  expect(lastArgs()).toEqual({ p_location: '', p_keyword: '', p_page: 1, p_page_size: 9, p_sort: 'newest' });
  expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
  expect(screen.getByLabelText('Pet type')).toHaveValue('');
  expect(screen.getByLabelText('Minimum capacity')).toHaveValue('');
  expect(screen.getByLabelText('Start date')).toHaveValue('');
  expect(screen.getByLabelText('End date')).toHaveValue('');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Location')).toHaveFocus();
});
