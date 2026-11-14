import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BookingWithDetails } from '../lib/bookingApi';

interface CancelBookingDialogProps {
  readonly booking: BookingWithDetails;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => Promise<void>;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

export function CancelBookingDialog({
  booking,
  isOpen,
  onClose,
  onConfirm,
}: CancelBookingDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const isConfirmingRef = useRef(isConfirming);
  onCloseRef.current = onClose;
  isConfirmingRef.current = isConfirming;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isConfirmingRef.current) onCloseRef.current();
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
    if (isConfirming) {
      dialogRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen, isConfirming]);

  if (!isOpen) return null;

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      onClose();
    }
  }

  const dateRange = `${formatBookingDate(booking.start_date)} – ${formatBookingDate(booking.end_date)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isConfirming) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-dialog-title"
        aria-describedby="cancel-booking-dialog-description"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="cancel-booking-dialog-title" className="text-lg font-semibold text-gray-900">
          Cancel booking for {booking.pet.name}?
        </h2>
        <p id="cancel-booking-dialog-description" className="mt-3 text-sm text-gray-600">
          This will cancel your request at {booking.listing.title} for {dateRange}. This action can’t be undone.
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClose}
            disabled={isConfirming}
          >
            Keep booking
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleConfirm()}
            disabled={isConfirming}
          >
            {isConfirming ? 'Cancelling...' : 'Cancel booking'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
