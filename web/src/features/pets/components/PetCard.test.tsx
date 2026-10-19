/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Pet } from '../lib/petApi';
import { PetCard } from './PetCard';

// jest.mock is hoisted above these declarations, so referenced state must be named mock*.
const mockUsePetPhotoUrl = jest.fn<{ data: string | undefined }, [string | null]>();

jest.mock('../hooks/usePets', () => ({
  useDeletePet: () => ({ mutateAsync: jest.fn(), isPending: false }),
  usePetPhotoUrl: (photoPath: string | null) => mockUsePetPhotoUrl(photoPath),
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
  deleted_at: null,
};

function renderCard(pet: Pet = rocket) {
  return render(
    <MemoryRouter>
      <PetCard pet={pet} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUsePetPhotoUrl.mockReset();
  mockUsePetPhotoUrl.mockReturnValue({ data: undefined });
});

describe('PetCard photo', () => {
  it('shows the placeholder when the pet has no photo', () => {
    const { container } = renderCard();

    expect(mockUsePetPhotoUrl).toHaveBeenCalledWith(null);
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the photo through its signed URL', () => {
    mockUsePetPhotoUrl.mockReturnValue({ data: 'https://signed.example/rocket.png' });
    const { container } = renderCard({ ...rocket, photo_url: 'pet-4/photo.png' });

    expect(mockUsePetPhotoUrl).toHaveBeenCalledWith('pet-4/photo.png');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://signed.example/rocket.png');
  });

  it('falls back to the placeholder when the photo fails to load', () => {
    mockUsePetPhotoUrl.mockReturnValue({ data: 'https://signed.example/expired.png' });
    const { container } = renderCard({ ...rocket, photo_url: 'pet-4/photo.png' });

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
  });
});

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
