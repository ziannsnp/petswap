import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => Promise<void> | void;
}

const DEFAULT_TITLE = 'Are you sure?';
const DEFAULT_DESCRIPTION = 'This action cannot be undone.';
const DEFAULT_CONFIRM_LABEL = 'Confirm';
const DEFAULT_CANCEL_LABEL = 'Cancel';

export function ConfirmDialog({
  isOpen,
  onClose,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  onConfirm,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) {
      setIsPending(false);
      setErrorMessage(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      if (onConfirm) {
        await onConfirm();
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      setErrorMessage(message);
      setIsPending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity animate-in fade-in duration-200">
      {/* Click backdrop to dismiss if not in progress */}
      <div
        data-testid="confirm-dialog-backdrop"
        className="fixed inset-0"
        onClick={() => {
          if (!isPending) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>
        </div>

        <p id="confirm-dialog-description" className="mt-3 text-sm text-gray-600">
          {description}
        </p>

        {errorMessage && (
          <p role="alert" className="mt-3 form-alert">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="btn-cancel disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}