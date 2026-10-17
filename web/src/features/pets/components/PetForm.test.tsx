/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import type { PetFormValues } from '../lib/petForm';
import { cropPhoto } from '@/shared/lib/photoCrop';
import { PetForm } from './PetForm';

// Canvas is not implemented in jsdom; photoCrop.test.ts covers the drawing itself.
jest.mock('@/shared/lib/photoCrop', () => ({
  ...jest.requireActual('@/shared/lib/photoCrop'),
  cropPhoto: jest.fn(),
}));

const mockCropPhoto = jest.mocked(cropPhoto);

type PetFormProps = ComponentProps<typeof PetForm>;

const onSubmit = jest.fn();
const onCancel = jest.fn();
const onEdit = jest.fn();

const rocketValues: PetFormValues = {
  name: 'Rocket',
  species: 'dog',
  breed: 'Beagle mix',
  age: '4',
  description: 'Friendly with other dogs.',
};

function renderForm(props: Partial<PetFormProps> = {}) {
  return render(
    <PetForm
      submitLabel="Save pet"
      pendingLabel="Saving..."
      isSubmitting={false}
      submitError={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onEdit={onEdit}
      {...props}
    />,
  );
}

function photoFile(name = 'rocket.png', type = 'image/png') {
  return new File(['photo'], name, { type });
}

function photoInput() {
  return screen.getByLabelText('Pet photo') as HTMLInputElement;
}

/** fireEvent rather than user.upload, which would drop a file the accept list filters out. */
function choosePhoto(file: File) {
  fireEvent.change(photoInput(), { target: { files: [file] } });
}

type User = ReturnType<typeof userEvent.setup>;

/** Loads the photo in the open crop dialog, optionally zooms, and confirms the crop. */
async function confirmCrop(user: User, zoom?: number) {
  const image = await screen.findByAltText('Photo being cropped');
  Object.defineProperty(image, 'naturalWidth', { value: 400, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: 300, configurable: true });
  fireEvent.load(image);
  if (zoom !== undefined) {
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: String(zoom) } });
  }
  await user.click(screen.getByRole('button', { name: 'Use photo' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

async function chooseAndCropPhoto(user: User, file: File, zoom?: number) {
  await user.upload(photoInput(), file);
  await confirmCrop(user, zoom);
}

let blobCount = 0;

beforeEach(() => {
  jest.clearAllMocks();
  blobCount = 0;
  URL.createObjectURL = jest.fn(() => `blob:preview-${(blobCount += 1)}`);
  URL.revokeObjectURL = jest.fn();
  mockCropPhoto.mockImplementation(async (_image, _crop, fileName) =>
    new File(['cropped'], `cropped-${fileName}`, { type: 'image/jpeg' }));
});

describe('PetForm fields', () => {
  it('starts empty with species unchosen and marks the required fields', () => {
    renderForm();

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByLabelText(/species/i)).toHaveValue('');
    expect(screen.getByLabelText(/breed/i)).toHaveValue('');
    expect(screen.getByLabelText(/age/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
    expect(screen.getByText('Breed').parentElement).toHaveTextContent('(optional)');
    expect(screen.getByLabelText(/age/i)).toHaveAccessibleDescription('Use 0 for pets under one year old.');
  });

  it('prefills the fields from initialValues', () => {
    renderForm({ initialValues: rocketValues });

    expect(screen.getByLabelText(/name/i)).toHaveValue('Rocket');
    expect(screen.getByLabelText(/species/i)).toHaveValue('dog');
    expect(screen.getByLabelText(/breed/i)).toHaveValue('Beagle mix');
    expect(screen.getByLabelText(/age/i)).toHaveValue('4');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Friendly with other dogs.');
  });

  it('reports an edit on every change so the caller can clear a stale error', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/name/i), 'Mo');
    await user.selectOptions(screen.getByLabelText(/species/i), 'cat');

    expect(onEdit).toHaveBeenCalledTimes(3);
  });
});

describe('PetForm validation', () => {
  it('hides errors until the first submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/age/i), 'abc');

    expect(screen.getByLabelText(/age/i)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/whole number/)).not.toBeInTheDocument();
  });

  it('blocks submission and links each error to its field', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/age/i), '2.5');
    await user.click(screen.getByRole('button', { name: 'Save pet' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/name/i)).toHaveAccessibleDescription('Pet name is required.');
    expect(screen.getByLabelText(/species/i)).toHaveAccessibleDescription('Choose a species.');
    expect(screen.getByLabelText(/description/i)).toHaveAccessibleDescription('Description is required.');
    // The hint stays alongside the error.
    expect(screen.getByLabelText(/age/i)).toHaveAccessibleDescription(
      'Use 0 for pets under one year old. Age must be a whole number of years, 0 or more.',
    );
    expect(screen.getByLabelText(/breed/i)).not.toHaveAttribute('aria-invalid');
  });

  it('clears an error as soon as the field becomes valid after a submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    await user.type(screen.getByLabelText(/name/i), 'Mali');

    expect(screen.getByLabelText(/name/i)).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Pet name is required.')).not.toBeInTheDocument();
    expect(screen.getByText('Choose a species.')).toBeInTheDocument();
  });

  it('submits the parsed values without photo fields when the picker is untouched', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: { ...rocketValues, age: '' }, hasSavedPhoto: true, savedPhotoUrl: 'https://signed.example/rocket.png' });

    await user.click(screen.getByRole('button', { name: 'Save pet' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Rocket',
      species: 'dog',
      breed: 'Beagle mix',
      ageYear: null,
      description: 'Friendly with other dogs.',
    });
  });
});

describe('PetForm photo picker', () => {
  it('opens the file picker from the Choose photo button', async () => {
    const user = userEvent.setup();
    renderForm();
    const click = jest.spyOn(photoInput(), 'click');

    await user.click(screen.getByRole('button', { name: 'Choose photo' }));

    expect(click).toHaveBeenCalled();
    expect(photoInput()).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/gif');
  });

  it('shows the paw placeholder without a photo', () => {
    renderForm();

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  it('opens the crop dialog for a chosen photo and previews the cropped result', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.upload(photoInput(), photoFile());
    expect(screen.getByRole('dialog', { name: 'Crop profile photo' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Preview of the chosen pet photo' })).not.toBeInTheDocument();

    await confirmCrop(user);

    expect(mockCropPhoto).toHaveBeenCalledWith(expect.any(HTMLImageElement), expect.objectContaining({ zoom: 1 }), 'rocket.png');
    // blob:preview-1 was the original in the dialog, released when it closed.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(screen.getByRole('img', { name: 'Preview of the chosen pet photo' })).toHaveAttribute('src', 'blob:preview-2');
    expect(onEdit).toHaveBeenCalled();
  });

  it('revokes the previous preview when another photo is chosen, and on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderForm();

    await chooseAndCropPhoto(user, photoFile('first.png'));
    await chooseAndCropPhoto(user, photoFile('second.png'));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview-4');

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-4');
  });

  it('accepts the same file chosen twice in a row', async () => {
    const user = userEvent.setup();
    const file = photoFile();
    renderForm();

    await user.upload(photoInput(), file);
    expect(photoInput()).toHaveValue('');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await user.upload(photoInput(), file);

    expect(screen.getByRole('dialog', { name: 'Crop profile photo' })).toBeInTheDocument();
  });

  it('keeps the current photo when the crop is cancelled', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: rocketValues, hasSavedPhoto: true, savedPhotoUrl: 'https://signed.example/rocket.png' });

    await user.upload(photoInput(), photoFile());
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Current pet photo' })).toHaveAttribute('src', 'https://signed.example/rocket.png');
    expect(screen.queryByRole('button', { name: 'Adjust crop' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('photo');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('re-crops the original photo from the last crop with Adjust crop', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: rocketValues });

    await chooseAndCropPhoto(user, photoFile('rocket.png'), 2);
    await user.click(screen.getByRole('button', { name: 'Adjust crop' }));

    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
    await confirmCrop(user);

    // Cropped from the original, not from the already-cropped file.
    expect(mockCropPhoto).toHaveBeenLastCalledWith(expect.any(HTMLImageElement), expect.objectContaining({ zoom: 2 }), 'rocket.png');
    await user.click(screen.getByRole('button', { name: 'Save pet' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ photo: expect.objectContaining({ name: 'cropped-rocket.png' }) }));
  });

  it('forgets the original on Remove photo', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseAndCropPhoto(user, photoFile());
    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    expect(screen.queryByRole('button', { name: 'Adjust crop' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeInTheDocument();
  });

  it('announces a rejected photo without opening the crop dialog, and clears it once a valid one is chosen', () => {
    renderForm();

    choosePhoto(photoFile('notes.pdf', 'application/pdf'));
    expect(screen.getByRole('alert')).toHaveTextContent('Unsupported file type.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();

    // fireEvent again: the first one left `files` a plain array that user.upload cannot replace.
    choosePhoto(photoFile());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Crop profile photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose photo' })).toHaveAccessibleDescription('JPG, PNG, WebP, or GIF, up to 10 MB.');
  });

  it('clears a photo error on Remove photo', async () => {
    const user = userEvent.setup();
    renderForm({ hasSavedPhoto: true, savedPhotoUrl: 'https://signed.example/rocket.png' });

    choosePhoto(photoFile('notes.pdf', 'application/pdf'));
    // The rejected file left the saved photo in place.
    expect(screen.getByRole('img', { name: 'Current pet photo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to the placeholder when the saved photo fails to load', () => {
    renderForm({ hasSavedPhoto: true, savedPhotoUrl: 'https://signed.example/expired.png' });

    fireEvent.error(screen.getByRole('img', { name: 'Current pet photo' }));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
  });

  it('submits only the new cropped photo after removing the saved one and choosing another', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: rocketValues, hasSavedPhoto: true, savedPhotoUrl: 'https://signed.example/rocket.png' });

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));
    await chooseAndCropPhoto(user, photoFile());
    await user.click(screen.getByRole('button', { name: 'Save pet' }));

    const { photo } = onSubmit.mock.calls[0][0];
    expect(photo).toBeInstanceOf(File);
    expect(photo).toMatchObject({ name: 'cropped-rocket.png', type: 'image/jpeg' });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('removePhoto');
  });

  it('keeps the chosen photo when text validation blocks the submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await chooseAndCropPhoto(user, photoFile());
    await user.click(screen.getByRole('button', { name: 'Save pet' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Preview of the chosen pet photo' })).toBeInTheDocument();
  });
});

describe('PetForm submit state', () => {
  it('disables every control and shows the pending label while submitting', () => {
    renderForm({ isSubmitting: true, hasSavedPhoto: true });

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeDisabled();
    expect(photoInput()).toBeDisabled();
    for (const field of [/name/i, /species/i, /breed/i, /age/i, /description/i]) {
      expect(screen.getByLabelText(field)).toBeDisabled();
    }
  });

  it('shows the caller\'s save error', () => {
    renderForm({ submitError: 'We could not save your pet.' });

    expect(screen.getByRole('alert')).toHaveTextContent('We could not save your pet.');
  });

  it('cancels without submitting', async () => {
    const user = userEvent.setup();
    renderForm({ initialValues: rocketValues });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
