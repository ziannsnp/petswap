/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DeletePetDialog } from './DeletePetDialog';
import { useDeletePet } from '../hooks/usePets';
import { PetHasBookingsError } from '../lib/petErrors';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/usePets', () => ({
  useDeletePet: jest.fn(),
}));

const mockedUseDeletePet = jest.mocked(useDeletePet);
const pet = { id: 'pet-1', name: 'Rocket' };

function mockDeletePet({ mutateAsync = jest.fn().mockResolvedValue(undefined), isPending = false } = {}) {
  mockedUseDeletePet.mockReturnValue({ mutateAsync, isPending } as unknown as ReturnType<typeof useDeletePet>);
  return mutateAsync;
}

function renderDialog({ isOpen = true, onClose = jest.fn() } = {}) {
  const ui = (open: boolean) => (
    <MemoryRouter>
      <button type="button">Open delete dialog</button>
      <DeletePetDialog pet={pet} isOpen={open} onClose={onClose} />
    </MemoryRouter>
  );
  const { rerender } = render(ui(isOpen));
  return { onClose, setOpen: (open: boolean) => rerender(ui(open)) };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('DeletePetDialog', () => {
  it('renders nothing while closed', () => {
    mockDeletePet();
    renderDialog({ isOpen: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('names the pet and focuses Cancel first', () => {
    mockDeletePet();
    renderDialog();

    expect(screen.getByRole('alertdialog', { name: 'Delete Rocket?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('deletes the pet and returns to the list', async () => {
    const mutateAsync = mockDeletePet();
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mutateAsync).toHaveBeenCalledWith('pet-1');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/pets', { replace: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the pet when Cancel is clicked', async () => {
    const mutateAsync = mockDeletePet();
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps the pet when Escape is pressed', async () => {
    const mutateAsync = mockDeletePet();
    const { onClose } = renderDialog();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('explains that a pet with bookings cannot be deleted', async () => {
    mockDeletePet({ mutateAsync: jest.fn().mockRejectedValue(new PetHasBookingsError()) });
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Rocket has bookings, so it can't be deleted.");
    expect(onClose).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic message for any other failure', async () => {
    mockDeletePet({ mutateAsync: jest.fn().mockRejectedValue(new Error('PGRST500 internal error')) });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't delete Rocket. Please try again.");
    expect(alert).not.toHaveTextContent('PGRST500');
  });

  it('keeps the pet when the backdrop is clicked', async () => {
    const mutateAsync = mockDeletePet();
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByTestId('delete-pet-dialog-backdrop'));

    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('clears an old error when the dialog is opened again', async () => {
    mockDeletePet({ mutateAsync: jest.fn().mockRejectedValue(new PetHasBookingsError()) });
    const { setOpen } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    setOpen(false);
    setOpen(true);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps Tab focus inside the dialog', async () => {
    mockDeletePet();
    renderDialog();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('returns focus to the button that opened it', () => {
    mockDeletePet();
    const { setOpen } = renderDialog({ isOpen: false });
    const opener = screen.getByRole('button', { name: 'Open delete dialog' });
    opener.focus();

    setOpen(true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    setOpen(false);

    expect(opener).toHaveFocus();
  });

  it('cannot be dismissed while the delete is in progress', async () => {
    mockDeletePet({ isPending: true });
    const { onClose } = renderDialog();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('alertdialog')).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByTestId('delete-pet-dialog-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
