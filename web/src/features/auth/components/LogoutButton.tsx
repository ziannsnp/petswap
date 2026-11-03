import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';

export interface LogoutButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  className?: string;
  children?: ReactNode;
  dialogTitle?: string;
  dialogDescription?: string;
  redirectTo?: string;
  onConfirm?: () => Promise<void> | void;
}

export function LogoutButton({
  className,
  children,
  dialogTitle,
  dialogDescription,
  redirectTo,
  onConfirm,
  type = 'button',
  ...props
}: LogoutButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const defaultClassName =
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-red-600 transition-colors';

  return (
    <>
      <button
        type={type}
        onClick={() => setIsDialogOpen(true)}
        className={className ?? defaultClassName}
        {...props}
      >
        {children ?? (
          <>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Log out</span>
          </>
        )}
      </button>

      <LogoutConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={dialogTitle}
        description={dialogDescription}
        redirectTo={redirectTo}
        onConfirm={onConfirm}
      />
    </>
  );
}
