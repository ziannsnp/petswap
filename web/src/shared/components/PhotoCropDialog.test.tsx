/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { cropPhoto } from '../lib/photoCrop';
import { PhotoCropDialog } from './PhotoCropDialog';

// Canvas is not implemented in jsdom; photoCrop.test.ts covers the drawing itself.
jest.mock('../lib/photoCrop', () => ({
  ...jest.requireActual('../lib/photoCrop'),
  cropPhoto: jest.fn(),
}));

const mockCropPhoto = jest.mocked(cropPhoto);
const onConfirm = jest.fn();
const onCancel = jest.fn();
const source = new File(['photo'], 'mali.png', { type: 'image/png' });
const cropped = new File(['cropped'], 'mali.jpg', { type: 'image/jpeg' });

/** The frame measures 200px, and the photo is 400×200, so at zoom 1 one screen pixel is one image pixel. */
const FRAME_SIZE = 200;

function renderDialog(props: Partial<ComponentProps<typeof PhotoCropDialog>> = {}) {
  return render(<PhotoCropDialog file={source} onConfirm={onConfirm} onCancel={onCancel} {...props} />);
}

function cropImage() {
  return screen.getByAltText('Photo being cropped');
}

function cropArea() {
  return screen.getByRole('group', { name: 'Crop area' });
}

function loadImage(width = 400, height = 200) {
  const image = cropImage();
  Object.defineProperty(image, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(image);
}

// jsdom has no PointerEvent, so fireEvent.pointer* would otherwise drop clientX and pointerId.
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeAll(() => {
  window.PointerEvent ??= TestPointerEvent as unknown as typeof PointerEvent;
});

beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:crop-source');
  URL.revokeObjectURL = jest.fn();
  mockCropPhoto.mockResolvedValue(cropped);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: FRAME_SIZE, height: FRAME_SIZE, top: 0, left: 0, right: FRAME_SIZE, bottom: FRAME_SIZE, x: 0, y: 0, toJSON: () => ({}),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PhotoCropDialog loading', () => {
  it('waits for the photo to load before cropping is possible', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Crop profile photo' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Zoom' })).toBeDisabled();

    loadImage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeEnabled();
    expect(cropImage()).toHaveStyle({ width: '200%', height: '100%', left: '-50%', top: '0%' });
  });

  it('shows the original photo and releases its URL on close', () => {
    const { unmount } = renderDialog();

    expect(URL.createObjectURL).toHaveBeenCalledWith(source);
    expect(cropImage()).toHaveAttribute('src', 'blob:crop-source');

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:crop-source');
  });

  it('explains when the photo cannot be opened', () => {
    renderDialog();

    fireEvent.error(cropImage());

    expect(screen.getByRole('alert')).toHaveTextContent('We could not open this photo. Choose a different file.');
    expect(screen.getByRole('button', { name: 'Use photo' })).toBeDisabled();
  });
});

describe('PhotoCropDialog positioning', () => {
  it('moves the photo with a drag and stops at its edge', () => {
    renderDialog();
    loadImage();

    fireEvent.pointerDown(cropArea(), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(cropArea(), { pointerId: 1, clientX: 140, clientY: 100 });
    expect(cropImage()).toHaveStyle({ left: '-30%' });

    fireEvent.pointerMove(cropArea(), { pointerId: 1, clientX: 900, clientY: 100 });
    expect(cropImage()).toHaveStyle({ left: '0%' });

    fireEvent.pointerUp(cropArea(), { pointerId: 1 });
    fireEvent.pointerMove(cropArea(), { pointerId: 1, clientX: 0, clientY: 100 });
    expect(cropImage()).toHaveStyle({ left: '0%' });
  });

  it('moves the photo with the arrow keys', async () => {
    const user = userEvent.setup();
    renderDialog();
    loadImage();

    expect(cropArea()).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    // Right shows more of the right side, so the photo slides 20px left.
    expect(cropImage()).toHaveStyle({ left: '-60%' });
  });

  it('zooms with the slider and the + and - keys', async () => {
    const user = userEvent.setup();
    renderDialog();
    loadImage();

    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '2' } });
    expect(cropImage()).toHaveStyle({ width: '400%', height: '200%' });

    cropArea().focus();
    await user.keyboard('-');
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('1.9');

    await user.keyboard('+');
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
  });

  it('tells the owner to zoom in when a square photo has no room to move', () => {
    renderDialog();
    loadImage(300, 300);

    expect(cropArea()).toHaveAccessibleDescription('The photo fills the circle. Zoom in to move it.');

    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '1.5' } });
    expect(cropArea()).toHaveAccessibleDescription('Drag the photo or use the arrow keys to position it inside the circle.');
  });

  it('starts from a previous crop', () => {
    renderDialog({ initialCrop: { zoom: 2, centerX: 0.25, centerY: 0.5 } });
    loadImage();

    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('2');
    expect(cropImage()).toHaveStyle({ left: '-50%', top: '-50%' });
  });
});

describe('PhotoCropDialog actions', () => {
  it('crops the original photo and hands back the result and the crop used', async () => {
    const user = userEvent.setup();
    renderDialog();
    loadImage();
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '2' } });

    await user.click(screen.getByRole('button', { name: 'Use photo' }));

    const crop = { zoom: 2, centerX: 0.5, centerY: 0.5 };
    expect(mockCropPhoto).toHaveBeenCalledWith(cropImage(), crop, 'mali.png');
    expect(onConfirm).toHaveBeenCalledWith(cropped, crop);
  });

  it('locks the dialog while cropping', async () => {
    const user = userEvent.setup();
    mockCropPhoto.mockReturnValue(new Promise(() => {}));
    renderDialog();
    loadImage();

    await user.click(screen.getByRole('button', { name: 'Use photo' }));

    expect(screen.getByRole('button', { name: 'Cropping...' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cropping...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('reports a failed crop and lets the owner try again', async () => {
    const user = userEvent.setup();
    mockCropPhoto.mockRejectedValueOnce(new Error('canvas failed'));
    renderDialog();
    loadImage();

    await user.click(screen.getByRole('button', { name: 'Use photo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not crop this photo.');
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Use photo' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(cropped, expect.anything()));
  });

  it('cancels with the Cancel button or Escape', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(mockCropPhoto).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderDialog();
    loadImage();

    expect(cropArea()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Use photo' })).toHaveFocus();
    await user.tab();
    expect(cropArea()).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Use photo' })).toHaveFocus();
  });

  it('returns focus to the control that opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderDialog();
    expect(opener).not.toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
