import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react';
import {
  canPanPhotoCrop,
  clampPhotoCrop,
  cropPhoto,
  DEFAULT_PHOTO_CROP,
  panPhotoCrop,
  PHOTO_CROP_MAX_ZOOM,
  photoCropImageStyle,
  zoomPhotoCrop,
  type ImageSize,
  type PhotoCrop,
} from '../lib/photoCrop';

interface PhotoCropDialogProps {
  /** The original photo; it is never changed, so the owner can crop it again later. */
  file: File;
  initialCrop?: PhotoCrop;
  onConfirm: (croppedPhoto: File, crop: PhotoCrop) => void;
  onCancel: () => void;
}

const KEYBOARD_PAN_PIXELS = 10;
const KEYBOARD_ZOOM_STEP = 0.1;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// Focus handling follows the app's other dialogs: Tab stays inside the dialog, Escape cancels,
// and focus returns to whatever opened it when it closes.
export function PhotoCropDialog({ file, initialCrop = DEFAULT_PHOTO_CROP, onConfirm, onCancel }: PhotoCropDialogProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [crop, setCrop] = useState<PhotoCrop>(initialCrop);
  const [isCropping, setIsCropping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const isCroppingRef = useRef(isCropping);
  isCroppingRef.current = isCropping;

  // Created in an effect, not during render, so StrictMode's double mount cannot leak a URL.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    frameRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isCroppingRef.current) onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusedIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (focusedIndex === -1 || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  // Before the photo loads, the general instructions are the useful ones.
  const canPan = imageSize ? canPanPhotoCrop(crop, imageSize) : true;

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    setImageSize(size);
    setCrop((current) => clampPhotoCrop(current, size));
  };

  const pan = (dx: number, dy: number) => {
    const frameSize = frameRef.current?.getBoundingClientRect().width;
    if (!imageSize || !frameSize) return;
    setCrop((current) => panPhotoCrop(current, imageSize, dx, dy, frameSize));
  };

  const zoomTo = (zoom: number) => {
    if (!imageSize) return;
    setCrop((current) => zoomPhotoCrop(current, imageSize, zoom));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSize || isCropping) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pan(event.clientX - drag.x, event.clientY - drag.y);
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleFrameKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isCropping) return;
    const direction = PAN_KEYS[event.key];
    if (direction) {
      event.preventDefault();
      // The photo moves under the frame, so pressing Right shows more of the right side.
      pan(-direction[0] * KEYBOARD_PAN_PIXELS, -direction[1] * KEYBOARD_PAN_PIXELS);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(crop.zoom + KEYBOARD_ZOOM_STEP);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(crop.zoom - KEYBOARD_ZOOM_STEP);
    }
  };

  const handleConfirm = async () => {
    const image = imageRef.current;
    if (!image || !imageSize) return;
    setErrorMessage(null);
    setIsCropping(true);

    try {
      const croppedPhoto = await cropPhoto(image, crop, file.name);
      onConfirm(croppedPhoto, crop);
    } catch {
      setErrorMessage('We could not crop this photo. Try again or choose a different photo.');
      setIsCropping(false);
    }
  };

  const handleImageError = () => {
    setErrorMessage('We could not open this photo. Choose a different file.');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="fixed inset-0" onClick={() => { if (!isCropping) onCancel(); }} aria-hidden="true" />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        aria-describedby="photo-crop-help"
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="photo-crop-title" className="text-lg font-semibold text-gray-900">Crop profile photo</h2>
        <p id="photo-crop-help" className="mt-1 text-sm text-gray-600">
          {canPan
            ? 'Drag the photo or use the arrow keys to position it inside the circle.'
            : 'The photo fills the circle. Zoom in to move it.'}
        </p>

        <div
          ref={frameRef}
          className={`relative mx-auto mt-4 aspect-square w-full max-w-xs touch-none select-none overflow-hidden rounded-lg bg-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${canPan ? 'cursor-grab active:cursor-grabbing' : ''}`}
          tabIndex={0}
          role="group"
          aria-label="Crop area"
          aria-describedby="photo-crop-help"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleFrameKeyDown}
        >
          {sourceUrl && (
            <img
              ref={imageRef}
              className={`absolute max-w-none ${imageSize ? '' : 'invisible'}`}
              src={sourceUrl}
              alt="Photo being cropped"
              draggable={false}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={imageSize ? photoCropImageStyle(crop, imageSize) : undefined}
            />
          )}
          {!imageSize && !errorMessage && (
            <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Loading photo">
              <LoaderCircle className="h-8 w-8 animate-spin text-white motion-reduce:animate-none" aria-hidden="true" />
            </div>
          )}
          <div className="photo-crop-mask pointer-events-none absolute inset-0 rounded-full border-2 border-white" aria-hidden="true" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomOut className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
          <input
            className="w-full accent-brand-600"
            type="range"
            min={1}
            max={PHOTO_CROP_MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => zoomTo(Number(event.target.value))}
            disabled={!imageSize || isCropping}
            aria-label="Zoom"
          />
          <ZoomIn className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        </div>

        {errorMessage && <p className="form-alert mt-4" role="alert">{errorMessage}</p>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onCancel}
            disabled={isCropping}
          >
            Cancel
          </button>
          <button
            className="btn-primary flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={!imageSize || isCropping}
            aria-busy={isCropping}
          >
            {isCropping && <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {isCropping ? 'Cropping...' : 'Use photo'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
