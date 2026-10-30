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

describe('PetCard care information', () => {
  it('hides the care information section when a pet has no care info', () => {
    renderCard(rocket);

    expect(screen.queryByRole('region', { name: 'Care information' })).not.toBeInTheDocument();
    expect(screen.queryByText('Care information')).not.toBeInTheDocument();
    expect(screen.queryByText('Feeding instructions')).not.toBeInTheDocument();
  });

  it('hides blank or whitespace-only care fields', () => {
    renderCard({
      ...rocket,
      feeding_instruction: '   ',
      medical_note: '',
      behavior_note: '   \n  ',
      allergies: null,
      vaccination_info: '',
      special_requirement: '   ',
    });

    expect(screen.queryByRole('region', { name: 'Care information' })).not.toBeInTheDocument();
    expect(screen.queryByText('Care information')).not.toBeInTheDocument();
  });

  it('renders only the care fields that have a value and hides blank fields', () => {
    renderCard({
      ...rocket,
      feeding_instruction: '2 cups twice daily',
      medical_note: null,
      behavior_note: '   ',
      allergies: 'Allergic to chicken',
      vaccination_info: '',
      special_requirement: null,
    });

    expect(screen.getByRole('region', { name: 'Care information' })).toBeInTheDocument();
    expect(screen.getByText('Care information')).toBeInTheDocument();

    // Populated fields are shown
    expect(screen.getByText('Feeding instructions')).toBeInTheDocument();
    expect(screen.getByText('2 cups twice daily')).toBeInTheDocument();
    expect(screen.getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText('Allergic to chicken')).toBeInTheDocument();

    // Blank / null fields are hidden
    expect(screen.queryByText('Medical notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Behavior notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Vaccination information')).not.toBeInTheDocument();
    expect(screen.queryByText('Special requirements')).not.toBeInTheDocument();
  });

  it('renders all 6 care fields when all have values', () => {
    renderCard({
      ...rocket,
      feeding_instruction: '1 can wet food morning and evening',
      medical_note: 'Daily eye drops at 8am',
      behavior_note: 'Shy around loud noises',
      allergies: 'Gluten sensitivity',
      vaccination_info: 'Rabies and DHPP up to date',
      special_requirement: 'Needs a soft bed due to hip dysplasia',
    });

    expect(screen.getByRole('region', { name: 'Care information' })).toBeInTheDocument();
    expect(screen.getByText('Feeding instructions')).toBeInTheDocument();
    expect(screen.getByText('1 can wet food morning and evening')).toBeInTheDocument();
    expect(screen.getByText('Medical notes')).toBeInTheDocument();
    expect(screen.getByText('Daily eye drops at 8am')).toBeInTheDocument();
    expect(screen.getByText('Behavior notes')).toBeInTheDocument();
    expect(screen.getByText('Shy around loud noises')).toBeInTheDocument();
    expect(screen.getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText('Gluten sensitivity')).toBeInTheDocument();
    expect(screen.getByText('Vaccination information')).toBeInTheDocument();
    expect(screen.getByText('Rabies and DHPP up to date')).toBeInTheDocument();
    expect(screen.getByText('Special requirements')).toBeInTheDocument();
    expect(screen.getByText('Needs a soft bed due to hip dysplasia')).toBeInTheDocument();
  });
});
