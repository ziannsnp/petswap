/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateListingScreen } from './CreateListingScreen';
import { useCreateListing } from '../hooks/useCreateListing';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useCreateListing', () => ({ useCreateListing: jest.fn() }));

const mockedUseCreateListing = jest.mocked(useCreateListing);

function mutationResult(overrides: Partial<ReturnType<typeof useCreateListing>> = {}) {
  return {
    mutateAsync: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCreateListing>;
}

function renderForm() {
  return render(
    <MemoryRouter>
      <CreateListingScreen />
    </MemoryRouter>,
  );
}

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: jest.fn(() => 'blob:photo') });
  Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn() });
});

describe('CreateListingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not submit invalid required values', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn();
    mockedUseCreateListing.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.click(screen.getByRole('button', { name: /save listing/i }));

    expect(screen.getByText('Listing title is required.')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('passes valid form values and selected photos to the mutation', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue({});
    mockedUseCreateListing.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/listing title/i), 'Quiet home');
    await user.type(screen.getByLabelText(/^location/i), 'Chiang Mai');
    await user.type(screen.getByLabelText(/^description/i), 'A calm place for pets.');
    await user.clear(screen.getByLabelText(/capacity/i));
    await user.type(screen.getByLabelText(/capacity/i), '2');
    await user.click(screen.getByRole('checkbox', { name: 'Fenced yard' }));
    await user.upload(screen.getByLabelText(/add listing photos/i), new File(['photo'], 'front-yard.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('button', { name: /save listing/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Quiet home',
      location: 'Chiang Mai',
      description: 'A calm place for pets.',
      capacity: 2,
      acceptedPetTypes: ['dog'],
      facilities: ['Fenced yard'],
      photos: [expect.any(File)],
    })));
  });

  it('disables form controls while the mutation is pending', () => {
    mockedUseCreateListing.mockReturnValue(mutationResult({ isPending: true }));
    renderForm();

    expect(screen.getByLabelText(/listing title/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('preserves entered values and shows an alert when the mutation fails', async () => {
    const user = userEvent.setup();
    let isError = false;
    const mutateAsync = jest.fn().mockImplementation(async () => {
      isError = true;
      throw new Error('save failed');
    });
    const mutation = mutationResult({ mutateAsync });
    Object.defineProperty(mutation, 'isError', { get: () => isError });
    mockedUseCreateListing.mockReturnValue(mutation);
    renderForm();

    const title = screen.getByLabelText(/listing title/i);
    await user.type(title, 'Keep this value');
    await user.type(screen.getByLabelText(/^location/i), 'Chiang Mai');
    await user.type(screen.getByLabelText(/^description/i), 'A calm place for pets.');
    await user.click(screen.getByRole('button', { name: /save listing/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(title).toHaveValue('Keep this value');
    expect(mutateAsync).toHaveBeenCalled();
  });

  it('resets a previous mutation error when the user edits the form', async () => {
    const user = userEvent.setup();
    const reset = jest.fn();
    mockedUseCreateListing.mockReturnValue(mutationResult({ isError: true, reset }));
    renderForm();

    await user.type(screen.getByLabelText(/listing title/i), 'Corrected title');

    expect(reset).toHaveBeenCalled();
  });

  it('navigates to my listings after a successful mutation', async () => {
    const user = userEvent.setup();
    const mutateAsync = jest.fn().mockResolvedValue({});
    mockedUseCreateListing.mockReturnValue(mutationResult({ mutateAsync }));
    renderForm();

    await user.type(screen.getByLabelText(/listing title/i), 'Quiet home');
    await user.type(screen.getByLabelText(/^location/i), 'Chiang Mai');
    await user.type(screen.getByLabelText(/^description/i), 'A calm place for pets.');
    await user.click(screen.getByRole('button', { name: /save listing/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/listings'));
  });
});