/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Pet } from '../lib/petApi';
import { PetsScreen } from './PetsScreen';

// jest.mock is hoisted above these declarations, so referenced state must be named mock*.
const mockPetsState: { data: Pet[] | undefined; isPending: boolean; isError: boolean } = {
  data: [],
  isPending: false,
  isError: false,
};

jest.mock('../hooks/usePets', () => ({
  useMyPets: () => mockPetsState,
}));

function pet(overrides: Partial<Pet>): Pet {
  return {
    id: 'pet-1',
    owner_id: 'owner-1',
    name: 'Mali',
    species: 'dog',
    breed: null,
    age_year: null,
    photo_url: null,
    description: null,
    feeding_instruction: null,
    medical_note: null,
    behavior_note: null,
    allergies: null,
    vaccination_info: null,
    special_requirement: null,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderScreen(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/pets', state }]}>
      <PetsScreen />
    </MemoryRouter>,
  );
}

afterEach(() => {
  mockPetsState.data = [];
  mockPetsState.isPending = false;
  mockPetsState.isError = false;
});

describe('PetsScreen', () => {
  it('invites an owner with no pets to add their first one', () => {
    renderScreen();

    expect(screen.getByRole('heading', { name: 'No pets yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first pet' })).toHaveAttribute('href', '/pets/new');
  });

  it('shows each pet with its species label, breed, age, and description', () => {
    mockPetsState.data = [
      pet({ id: 'pet-1', name: 'Mali', species: 'dog', breed: 'Golden Retriever', age_year: 3, description: 'Loves walks.' }),
      pet({ id: 'pet-2', name: 'Mochi', species: 'guinea_pig', age_year: 0 }),
      pet({ id: 'pet-3', name: 'Tofu', species: 'cat', age_year: 1 }),
    ];
    renderScreen();

    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Dog · Golden Retriever · 3 years old')).toBeInTheDocument();
    expect(screen.getByText('Loves walks.')).toBeInTheDocument();
    expect(screen.getByText('Guinea pig · Under 1 year old')).toBeInTheDocument();
    expect(screen.getByText('Cat · 1 year old')).toBeInTheDocument();
    expect(screen.queryByText('No pets yet')).not.toBeInTheDocument();
  });

  it('explains when pets cannot be loaded', () => {
    mockPetsState.data = undefined;
    mockPetsState.isError = true;
    renderScreen();

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load your pets/i);
    expect(screen.queryByText('No pets yet')).not.toBeInTheDocument();
  });

  it('shows a loading state instead of the empty state while pets load', () => {
    mockPetsState.data = undefined;
    mockPetsState.isPending = true;
    renderScreen();

    expect(screen.getByLabelText('Loading pets')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('No pets yet')).not.toBeInTheDocument();
  });

  it('confirms a newly saved pet', () => {
    renderScreen({ petSaved: true });

    expect(screen.getByRole('status')).toHaveTextContent('Pet saved successfully.');
  });
});
