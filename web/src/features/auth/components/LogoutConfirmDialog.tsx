import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  redirectTo?: string;
  onConfirm?: () => Promise<void> | void;
}

const DEFAULT_TITLE = 'Log out';
const DEFAULT_DESCRIPTION = 'Are you sure you want to log out of your account?';
const DEFAULT_REDIRECT = '/login';
const GENERIC_ERROR_MESSAGE = "We couldn't log you out. Please try again.";

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  redirectTo = DEFAULT_REDIRECT,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) {
      setIsLoggingOut(false);
      setErrorMessage(null);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoggingOut) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoggingOut, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      if (onConfirm) {
        await onConfirm();
        onClose();
      } else {
        await signOut();
        void navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
      setErrorMessage(message);
      setIsLoggingOut(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity animate-in fade-in duration-200">
      {/* Click backdrop to dismiss if not in progress */}
      <div
        data-testid="logout-dialog-backdrop"
        className="fixed inset-0"
        onClick={() => {
          if (!isLoggingOut) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="logout-dialog-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          </div>
        </div>

        <p id="logout-dialog-description" className="mt-3 text-sm text-gray-600">
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
            disabled={isLoggingOut}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoggingOut}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

