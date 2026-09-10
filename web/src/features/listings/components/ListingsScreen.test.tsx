/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingsScreen } from './ListingsScreen';

jest.mock('../hooks/useListings', () => ({
  useMyListings: () => ({
    data: [],
    isPending: false,
    isError: false,
  }),
}));

describe('ListingsScreen', () => {
  it('confirms that a newly created draft listing was saved', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/listings', state: { listingSaved: true } }]}>
        <ListingsScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Draft listing saved successfully. You can preview it from My listings.',
    );
  });
});