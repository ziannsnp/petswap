/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { cropPhoto } from '@/shared/lib/photoCrop';
import { CreatePetScreen } from './CreatePetScreen';

// Canvas is not implemented in jsdom; photoCrop.test.ts covers the drawing itself.
jest.mock('@/shared/lib/photoCrop', () => ({
  ...jest.requireActual('@/shared/lib/photoCrop'),
  cropPhoto: jest.fn(),
}));

const mockCropPhoto = jest.mocked(cropPhoto);
const croppedPhoto = new File(['cropped'], 'cropped.jpg', { type: 'image/jpeg' });

/** Chooses a photo and accepts the default crop, as an owner pressing "Use photo" would. */
async function chooseAndCropPhoto(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('Pet photo'), file);
  const image = await screen.findByAltText('Photo being cropped');
  Object.defineProperty(image, 'naturalWidth', { value: 400, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: 300, configurable: true });
  fireEvent.load(image);
  await user.click(screen.getByRole('button', { name: 'Use photo' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

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

function photoFile(name: string, type: string, size = 1024) {
  const file = new File(['photo'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** fireEvent rather than user.upload, which would drop a file the accept list filters out. */
function choosePhoto(file: File) {
  fireEvent.change(screen.getByLabelText('Pet photo'), { target: { files: [file] } });
}

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:pet-photo-preview');
  URL.revokeObjectURL = jest.fn();
  mockMutationState.isPending = false;
  mockMutationState.isError = false;
  mockMutateAsync.mockResolvedValue({ id: 'pet-1' });
  mockCropPhoto.mockResolvedValue(croppedPhoto);
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

  it('previews a cropped photo and saves the crop with the pet', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeInTheDocument();
    await chooseAndCropPhoto(user, photoFile('mali.png', 'image/png'));

    expect(screen.getByRole('img', { name: 'Preview of the chosen pet photo' })).toHaveAttribute('src', 'blob:pet-photo-preview');
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mali', photo: croppedPhoto }));
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('removePhoto');
  });

  it('rejects an unsupported file type and keeps the rest of the form', async () => {
    const user = userEvent.setup();
    renderScreen();

    await fillRequiredFields(user);
    choosePhoto(photoFile('notes.pdf', 'application/pdf'));

    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.');
    expect(screen.getByRole('button', { name: 'Choose photo' })).toHaveAccessibleDescription(
      'JPG, PNG, WebP, or GIF, up to 10 MB. Unsupported file type. Choose a JPG, PNG, WebP, or GIF file.',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveValue('Mali');
  });

  it('rejects a photo over 10 MB without replacing the chosen one', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseAndCropPhoto(user, photoFile('mali.jpg', 'image/jpeg'));
    choosePhoto(photoFile('huge.jpg', 'image/jpeg', 10_485_761));

    expect(screen.getByRole('alert')).toHaveTextContent('Photo is larger than the 10 MB limit.');
    expect(screen.getByRole('img', { name: 'Preview of the chosen pet photo' })).toBeInTheDocument();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ photo: croppedPhoto }));
  });

  it('drops a chosen photo on Remove photo', async () => {
    const user = userEvent.setup();
    renderScreen();

    await chooseAndCropPhoto(user, photoFile('mali.png', 'image/png'));
    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pet-photo-preview');

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /save pet/i }));

    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('photo');
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty('removePhoto');
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
