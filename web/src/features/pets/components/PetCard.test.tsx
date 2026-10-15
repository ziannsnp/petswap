/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Pet } from '../lib/petApi';
import { PetCard } from './PetCard';

jest.mock('../hooks/usePets', () => ({
  useDeletePet: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const rocket: Pet = {
  id: '20000000-0000-4000-8000-000000000004',
  owner_id: 'owner-1',
  name: 'Rocket',
  species: 'dog',
  breed: 'Beagle mix',
  age_year: 4,
  photo_url: null,
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

function renderCard() {
  return render(
    <MemoryRouter>
      <PetCard pet={rocket} />
    </MemoryRouter>,
  );
}

describe('PetCard actions', () => {
  it('links Edit to the pet\'s edit screen', () => {
    renderCard();

    expect(screen.getByRole('link', { name: 'Edit Rocket' })).toHaveAttribute(
      'href',
      '/pets/20000000-0000-4000-8000-000000000004/edit',
    );
  });

  it('opens the delete confirmation for this pet', async () => {
    renderCard();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Rocket' }));

    expect(screen.getByRole('alertdialog', { name: 'Delete Rocket?' })).toBeInTheDocument();
  });

  it('closes the confirmation on Cancel and returns focus to the Delete button', async () => {
    renderCard();
    const deleteButton = screen.getByRole('button', { name: 'Delete Rocket' });

    await userEvent.click(deleteButton);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
  });
});
