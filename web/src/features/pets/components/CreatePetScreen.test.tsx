/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CreatePetScreen } from './CreatePetScreen';

// jest.mock is hoisted above these declarations, so referenced state must be named mock*.
const mockMutateAsync = jest.fn();
const mockReset = jest.fn();
const mockMutationState = { isPending: false, isError: false };

jest.mock('../hooks/usePets', () => ({
  useCreatePet: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: mockMutationState.isPending,
    isError: mockMutationState.isError,
  }),
}));

function PetsRouteProbe() {
  const location = useLocation();
  return <p>Pets page{location.state?.petSaved ? ' after save' : ''}</p>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/pets/new']}>
      <Routes>
        <Route path="/pets/new" element={<CreatePetScreen />} />
        <Route path="/pets" element={<PetsRouteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/name/i), 'Mali');
  await user.selectOptions(screen.getByLabelText(/species/i), 'dog');
  await user.type(screen.getByLabelText(/description/i), 'Friendly and loves walks.');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMutationState.isPending = false;
  mockMutationState.isError = false;
  mockMutateAsync.mockResolvedValue({ id: 'pet-1' });
});

describe('CreatePetScreen', () => {
  it('blocks submission and explains each missing required field', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/name/i)).toHaveAccessibleDescription('Pet name is required.');
    expect(screen.getByLabelText(/species/i)).toHaveAccessibleDescription('Choose a species.');
    expect(screen.getByLabelText(/description/i)).toHaveAccessibleDescription('Description is required.');
  });

  it('rejects a fractional age without clearing the other fields', async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/age/i), '1.5');
    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/age/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Age must be a whole number of years, 0 or more.')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveValue('Mali');
  });

  it('saves a valid pet with breed optional and returns to My pets', async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/age/i), '3');
    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      name: 'Mali',
      species: 'dog',
      breed: '',
      ageYear: 3,
      description: 'Friendly and loves walks.',
    });
    expect(await screen.findByText('Pets page after save')).toBeInTheDocument();
  });

  it('keeps the owner on the form with an error when saving fails', async () => {
    mockMutationState.isError = true;
    mockMutateAsync.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('alert')).toHaveTextContent(/could not save your pet/i);
    await user.type(screen.getByLabelText(/name/i), 'M');
    expect(mockReset).toHaveBeenCalled();
  });

  it('disables the form while the pet is saving', () => {
    mockMutationState.isPending = true;
    renderScreen();

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
  });
});
