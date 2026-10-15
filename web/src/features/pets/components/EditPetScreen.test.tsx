/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Pet } from '../lib/petApi';
import { EditPetScreen } from './EditPetScreen';

// jest.mock is hoisted above these declarations, so referenced state must be named mock*.
const mockPetState: { data: Pet | null | undefined; isPending: boolean; isError: boolean } = {
  data: undefined,
  isPending: false,
  isError: false,
};
const mockMutateAsync = jest.fn();
const mockReset = jest.fn();
const mockMutationState = { isPending: false, isError: false };
const mockUsePet = jest.fn((petId: string) => {
  void petId;
  return mockPetState;
});

jest.mock('../hooks/usePets', () => ({
  usePet: (petId: string) => mockUsePet(petId),
  useUpdatePet: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: mockMutationState.isPending,
    isError: mockMutationState.isError,
  }),
}));

const PET_ID = '20000000-0000-4000-8000-000000000004';

const rocket: Pet = {
  id: PET_ID,
  owner_id: 'owner-1',
  name: 'Rocket',
  species: 'dog',
  breed: 'Beagle mix',
  age_year: 4,
  photo_url: 'pet-4/photo.png',
  description: 'Friendly with other dogs.',
  feeding_instruction: null,
  medical_note: null,
  behavior_note: null,
  allergies: null,
  vaccination_info: null,
  special_requirement: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

function PetsRouteProbe() {
  const location = useLocation();
  return <p>Pets page{location.state?.petSaved ? ' after save' : ''}</p>;
}

function screenTree(petId = PET_ID) {
  return (
    <MemoryRouter initialEntries={[`/pets/${petId}/edit`]}>
      <Routes>
        <Route path="/pets/:petId/edit" element={<EditPetScreen />} />
        <Route path="/pets" element={<PetsRouteProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderScreen(petId = PET_ID) {
  return render(screenTree(petId));
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPetState, { data: rocket, isPending: false, isError: false });
  Object.assign(mockMutationState, { isPending: false, isError: false });
  mockMutateAsync.mockResolvedValue(rocket);
});

describe('EditPetScreen', () => {
  it('loads the pet named in the URL', () => {
    renderScreen();

    expect(mockUsePet).toHaveBeenCalledWith(PET_ID);
  });

  it('shows a loading placeholder while the pet loads', () => {
    Object.assign(mockPetState, { data: undefined, isPending: true });
    renderScreen();

    expect(screen.getByLabelText('Loading pet')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
  });

  it('shows an error when the pet cannot be loaded', () => {
    Object.assign(mockPetState, { data: undefined, isError: true });
    renderScreen();

    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your pet');
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
  });

  it('shows "Pet not found" when the pet does not exist or is not the user\'s', () => {
    Object.assign(mockPetState, { data: null });
    renderScreen();

    expect(screen.getByRole('heading', { name: 'Pet not found' })).toBeInTheDocument();
    // One link at the top of the page, and one inside the not-found message.
    expect(screen.getAllByRole('link', { name: 'Back to my pets' })).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
  });

  it('prefills the form with the pet\'s data', () => {
    renderScreen();

    expect(screen.getByLabelText(/name/i)).toHaveValue('Rocket');
    expect(screen.getByLabelText(/species/i)).toHaveValue('dog');
    expect(screen.getByLabelText(/breed/i)).toHaveValue('Beagle mix');
    expect(screen.getByLabelText(/age/i)).toHaveValue('4');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Friendly with other dogs.');
  });

  it('saves only the text fields and returns to My Pets', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Rocket Jr');
    await user.clear(screen.getByLabelText(/age/i));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      petId: PET_ID,
      values: {
        name: 'Rocket Jr',
        species: 'dog',
        breed: 'Beagle mix',
        ageYear: null,
        description: 'Friendly with other dogs.',
      },
    });
    expect(mockMutateAsync.mock.calls[0][0].values).not.toHaveProperty('photo');
    expect(mockMutateAsync.mock.calls[0][0].values).not.toHaveProperty('removePhoto');
    expect(await screen.findByText('Pets page after save')).toBeInTheDocument();
  });

  it('blocks saving when a required field is cleared', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.clear(screen.getByLabelText(/description/i));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Description is required.')).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the input and shows an error when the save fails', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error('network down'));
    const { rerender } = renderScreen();

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Rocket Jr');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    // The rejected save must not navigate: the /pets route is mounted, so a navigation would show it.
    expect(mockMutateAsync).toHaveBeenCalled();
    expect(screen.queryByText(/Pets page/)).not.toBeInTheDocument();

    // The real mutation flips isError after a rejected mutateAsync; the mock mirrors that.
    mockMutationState.isError = true;
    rerender(screenTree());

    expect(screen.getByRole('alert')).toHaveTextContent('We could not save your changes.');
    expect(screen.getByLabelText(/name/i)).toHaveValue('Rocket Jr');
  });

  it('clears the save error as soon as the owner edits again', async () => {
    const user = userEvent.setup();
    mockMutationState.isError = true;
    renderScreen();

    await user.type(screen.getByLabelText(/breed/i), '!');

    expect(mockReset).toHaveBeenCalled();
  });

  it('disables the form while saving', () => {
    mockMutationState.isPending = true;
    renderScreen();

    expect(screen.getByRole('button', { name: 'Saving changes...' })).toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
  });

  it('keeps the form, not the load error, when a background refetch fails', () => {
    Object.assign(mockPetState, { data: rocket, isError: true });
    renderScreen();

    expect(screen.getByLabelText(/name/i)).toHaveValue('Rocket');
    expect(screen.queryByText('We could not load your pet')).not.toBeInTheDocument();
  });

  it('returns to My Pets without saving on Cancel', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText('Pets page')).toBeInTheDocument();
  });
});
