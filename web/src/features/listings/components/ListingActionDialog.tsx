import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ListingActionDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ListingActionDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending,
  errorMessage,
  onCancel,
  onConfirm,
}: ListingActionDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const isPendingRef = useRef(isPending);
  onCancelRef.current = onCancel;
  isPendingRef.current = isPending;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isPendingRef.current) onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const cancelButton = cancelButtonRef.current;
      const confirmButton = confirmButtonRef.current;
      if (!cancelButton || !confirmButton) return;
      const focusableButtons = [cancelButton, confirmButton].filter((button) => !button.disabled);

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

  useEffect(() => {
    if (!isOpen) return;
    if (isPending) {
      dialogRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen, isPending]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <section
        role="dialog"
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="listing-action-title"
        aria-describedby="listing-action-description"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        tabIndex={-1}
      >
        <h2 id="listing-action-title" className="text-lg font-semibold text-gray-900">{title}</h2>
        <p id="listing-action-description" className="mt-2 text-sm text-gray-600">{description}</p>
        {errorMessage && <p className="mt-3 text-sm text-red-700" role="alert">{errorMessage}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            className="btn-secondary min-h-10"
            type="button"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            className="min-h-10 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}