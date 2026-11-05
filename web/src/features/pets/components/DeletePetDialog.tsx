import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useDeletePet } from '../hooks/usePets';
import type { Pet } from '../lib/petApi';
import { PetHasBookingsError } from '../lib/petErrors';

interface DeletePetDialogProps {
  pet: Pick<Pet, 'id' | 'name'>;
  isOpen: boolean;
  onClose: () => void;
}

function deleteErrorMessage(error: unknown, petName: string): string {
  if (error instanceof PetHasBookingsError) {
    return `${petName} has active bookings, so it can't be deleted.`;
  }

  return `We couldn't delete ${petName}. Please try again.`;
}

// Focus handling follows ListingActionDialog: Tab stays inside the dialog, and focus
// returns to whatever opened it when it closes.
export function DeletePetDialog({ pet, isOpen, onClose }: DeletePetDialogProps) {
  const deletePetMutation = useDeletePet();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const isDeleting = deletePetMutation.isPending;

  function handleCancel() {
    if (isDeleting) {
      return;
    }

    setErrorMessage(null);
    onClose();
  }

  const handleCancelRef = useRef(handleCancel);
  handleCancelRef.current = handleCancel;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancelRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const cancelButton = cancelButtonRef.current;
      const deleteButton = deleteButtonRef.current;
      if (!cancelButton || !deleteButton) return;
      const focusableButtons = [cancelButton, deleteButton].filter((button) => !button.disabled);

      if (focusableButtons.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const focusedIndex = focusableButtons.indexOf(document.activeElement as HTMLButtonElement);
      if (focusedIndex === -1) {
        event.preventDefault();
        focusableButtons[event.shiftKey ? focusableButtons.length - 1 : 0].focus();
      } else if (event.shiftKey && focusedIndex === 0) {
        event.preventDefault();
        focusableButtons[focusableButtons.length - 1].focus();
      } else if (!event.shiftKey && focusedIndex === focusableButtons.length - 1) {
        event.preventDefault();
        focusableButtons[0].focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  // Cancel gets focus first, so pressing Enter straight away never deletes the pet. While
  // deleting, both buttons are disabled, so the dialog itself holds focus instead.
  useEffect(() => {
    if (!isOpen) return;
    if (isDeleting) {
      dialogRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen, isDeleting]);

  if (!isOpen) {
    return null;
  }

  async function handleDelete() {
    setErrorMessage(null);

    try {
      await deletePetMutation.mutateAsync(pet.id);
      onClose();
      void navigate('/pets', { replace: true });
    } catch (error) {
      setErrorMessage(deleteErrorMessage(error, pet.name));
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity animate-in fade-in duration-200">
      <div
        data-testid="delete-pet-dialog-backdrop"
        className="fixed inset-0"
        onClick={handleCancel}
        aria-hidden="true"
      />

      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-pet-dialog-title"
        aria-describedby="delete-pet-dialog-description"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id="delete-pet-dialog-title" className="text-lg font-semibold text-gray-900 break-words">
            Delete {pet.name}?
          </h2>
        </div>

        <p id="delete-pet-dialog-description" className="mt-3 text-sm text-gray-600">
          This removes {pet.name} from your pets and deletes its photo. Past bookings still show its name. You can't undo this.
        </p>

        {errorMessage && (
          <p role="alert" className="mt-3 form-alert">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleCancel}
            disabled={isDeleting}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            ref={deleteButtonRef}
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
