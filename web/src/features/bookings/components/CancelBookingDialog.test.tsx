/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BookingWithDetails } from '../lib/bookingApi';
import { CancelBookingDialog } from './CancelBookingDialog';

const booking = {
  id: 'booking-1',
  listing_id: 'listing-1',
  pet_id: 'pet-1',
  requester_id: 'requester-1',
  status: 'confirmed',
  start_date: '2026-09-10',
  end_date: '2026-09-14',
  requester_note: null,
  owner_note: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  confirmed_at: null,
  declined_at: null,
  cancelled_at: null,
  completed_at: null,
  pet: {
    id: 'pet-1',
    name: 'Milo',
    species: 'dog',
    photo_url: null,
    feeding_instruction: null,
    medical_note: null,
    behavior_note: null,
    allergies: null,
    vaccination_info: null,
    special_requirement: null,
  },
  listing: { id: 'listing-1', title: 'Cozy Yard', location: 'Austin' },
} as BookingWithDetails;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatBookingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function renderDialog({
  isOpen = true,
  onClose = jest.fn(),
  onConfirm = jest.fn().mockResolvedValue(undefined),
}: {
  isOpen?: boolean;
  onClose?: jest.Mock;
  onConfirm?: jest.Mock;
} = {}) {
  const ui = (open: boolean) => (
    <>
      <button type="button">Open cancellation dialog</button>
      <CancelBookingDialog booking={booking} isOpen={open} onClose={onClose} onConfirm={onConfirm} />
    </>
  );
  const view = render(ui(isOpen));
  return { ...view, onClose, onConfirm, setOpen: (open: boolean) => view.rerender(ui(open)) };
}

afterEach(() => {
  jest.clearAllMocks();
});

it('renders nothing when closed', () => {
  renderDialog({ isOpen: false });

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('shows booking details and focuses the safe action first', () => {
  renderDialog();

  const dialog = screen.getByRole('alertdialog', { name: 'Cancel booking for Milo?' });
  expect(dialog).toHaveTextContent('Cozy Yard');
  expect(dialog).toHaveTextContent(
    `${formatBookingDate(booking.start_date)} – ${formatBookingDate(booking.end_date)}`,
  );
  expect(within(dialog).getByRole('button', { name: 'Keep booking' })).toHaveFocus();
});

it('confirms cancellation and closes after the request resolves', async () => {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const { onClose } = renderDialog({ onConfirm });
  const dialog = screen.getByRole('alertdialog');

  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('lets the user keep the booking without confirming', async () => {
  const { onClose, onConfirm } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('dismisses with Escape and backdrop click without confirming', () => {
  const { onClose, onConfirm } = renderDialog();
  const backdrop = screen.getByRole('alertdialog').parentElement;
  expect(backdrop).not.toBeNull();

  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.mouseDown(backdrop!);

  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('prevents dismissal while cancellation is in progress', async () => {
  let resolveRequest!: () => void;
  const onConfirm = jest.fn(() => new Promise<void>((resolve) => {
    resolveRequest = resolve;
  }));
  const { onClose } = renderDialog({ onConfirm });

  await userEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

  expect(screen.getByRole('button', { name: 'Cancelling...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Keep booking' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();

  resolveRequest();
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

it('traps keyboard focus and restores focus when closed', async () => {
  const { setOpen } = renderDialog({ isOpen: false });
  const opener = screen.getByRole('button', { name: 'Open cancellation dialog' });
  opener.focus();

  setOpen(true);
  const dialog = screen.getByRole('alertdialog');
  const keepButton = within(dialog).getByRole('button', { name: 'Keep booking' });
  const confirmButton = within(dialog).getByRole('button', { name: 'Cancel booking' });
  expect(keepButton).toHaveFocus();

  await userEvent.tab({ shift: true });
  expect(confirmButton).toHaveFocus();
  await userEvent.tab();
  expect(keepButton).toHaveFocus();

  setOpen(false);
  expect(opener).toHaveFocus();
});
