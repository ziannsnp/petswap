// Shared by pet photos and account avatars, so both produce the same square, round-friendly image.

/**
 * Where the square profile crop sits in the source image. It is independent of the on-screen
 * frame size: `zoom` 1 shows the largest square that fits the image, and the center is a
 * fraction (0–1) of the image's width and height.
 */
export interface PhotoCrop {
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export const PHOTO_CROP_MAX_ZOOM = 3;

/** Avatars render at 112px at most, so 512px stays sharp on 4x screens and keeps uploads small. */
export const PHOTO_CROP_OUTPUT_SIZE = 512;

export const DEFAULT_PHOTO_CROP: PhotoCrop = { zoom: 1, centerX: 0.5, centerY: 0.5 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Side of the crop square in image pixels. */
function cropSide(zoom: number, image: ImageSize): number {
  return Math.min(image.width, image.height) / zoom;
}

/** Keeps the zoom in range and the crop square fully inside the image, so no empty edge is ever saved. */
export function clampPhotoCrop(crop: PhotoCrop, image: ImageSize): PhotoCrop {
  const zoom = clamp(crop.zoom, 1, PHOTO_CROP_MAX_ZOOM);
  const side = cropSide(zoom, image);
  const halfWidth = side / 2 / image.width;
  const halfHeight = side / 2 / image.height;

  return {
    zoom,
    centerX: clamp(crop.centerX, halfWidth, 1 - halfWidth),
    centerY: clamp(crop.centerY, halfHeight, 1 - halfHeight),
  };
}

/**
 * True when the photo can be dragged at this zoom. A photo never leaves an empty edge, so at
 * zoom 1 a square photo fills the frame exactly and only zooming in gives it room to move.
 */
export function canPanPhotoCrop(crop: PhotoCrop, image: ImageSize): boolean {
  const side = cropSide(clamp(crop.zoom, 1, PHOTO_CROP_MAX_ZOOM), image);
  // Half a pixel of slack absorbs rounding, so a near-square photo is not offered a useless drag.
  return image.width - side > 0.5 || image.height - side > 0.5;
}

export function zoomPhotoCrop(crop: PhotoCrop, image: ImageSize, zoom: number): PhotoCrop {
  return clampPhotoCrop({ ...crop, zoom }, image);
}

/**
 * Moves the photo by a drag of (dx, dy) screen pixels inside a frame `frameSize` pixels wide.
 * Dragging the photo right reveals more of its left side, so the crop center moves the other way.
 */
export function panPhotoCrop(
  crop: PhotoCrop,
  image: ImageSize,
  dx: number,
  dy: number,
  frameSize: number,
): PhotoCrop {
  const imagePixelsPerScreenPixel = cropSide(crop.zoom, image) / frameSize;

  return clampPhotoCrop({
    ...crop,
    centerX: crop.centerX - (dx * imagePixelsPerScreenPixel) / image.width,
    centerY: crop.centerY - (dy * imagePixelsPerScreenPixel) / image.height,
  }, image);
}

/** The crop square in source-image pixels. */
export function photoCropRect(crop: PhotoCrop, image: ImageSize) {
  const size = cropSide(crop.zoom, image);
  return {
    x: crop.centerX * image.width - size / 2,
    y: crop.centerY * image.height - size / 2,
    size,
  };
}

/**
 * Places the whole image behind a square frame so the frame shows exactly the crop. Values are
 * percentages of the frame, so the preview needs no measuring and survives a resize.
 */
export function photoCropImageStyle(crop: PhotoCrop, image: ImageSize) {
  const { x, y, size } = photoCropRect(crop, image);
  // Rounded so floating-point noise such as -60.00000000000001% stays out of the DOM.
  const percent = (value: number) => `${Math.round(value * 1_000_000) / 10_000}%`;
  return {
    width: percent(image.width / size),
    height: percent(image.height / size),
    left: percent(-x / size),
    top: percent(-y / size),
  };
}

function jpegFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]*$/, '') || 'pet-photo';
  return `${baseName}.jpg`;
}

/**
 * Draws the crop into a square JPEG, which keeps every upload small whatever was chosen.
 * Transparent areas get a white background instead of JPEG's black, and an animated GIF
 * keeps only its first frame. Small crops are not upscaled.
 */
export async function cropPhoto(image: HTMLImageElement, crop: PhotoCrop, fileName: string): Promise<File> {
  const imageSize = { width: image.naturalWidth, height: image.naturalHeight };
  const { x, y, size } = photoCropRect(clampPhotoCrop(crop, imageSize), imageSize);
  const outputSize = Math.max(1, Math.min(PHOTO_CROP_OUTPUT_SIZE, Math.round(size)));

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot crop photos.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outputSize, outputSize);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, x, y, size, size, 0, 0, outputSize, outputSize);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('This browser cannot crop photos.');

  return new File([blob], jpegFileName(fileName), { type: 'image/jpeg' });
}
