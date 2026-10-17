/** @jest-environment jsdom */
import {
  canPanPhotoCrop,
  clampPhotoCrop,
  cropPhoto,
  DEFAULT_PHOTO_CROP,
  panPhotoCrop,
  PHOTO_CROP_MAX_ZOOM,
  PHOTO_CROP_OUTPUT_SIZE,
  photoCropImageStyle,
  photoCropRect,
  zoomPhotoCrop,
} from './photoCrop';

const landscape = { width: 400, height: 200 };

/** Compares to a tenth of a pixel, since pan and zoom work in fractions of the image. */
function expectRect(actual: { x: number; y: number; size: number }, expected: { x: number; y: number; size: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 1);
  expect(actual.y).toBeCloseTo(expected.y, 1);
  expect(actual.size).toBeCloseTo(expected.size, 1);
}
const portrait = { width: 200, height: 400 };

describe('photoCropRect', () => {
  it('starts with the largest centered square that fits the image', () => {
    expect(photoCropRect(DEFAULT_PHOTO_CROP, landscape)).toEqual({ x: 100, y: 0, size: 200 });
    expect(photoCropRect(DEFAULT_PHOTO_CROP, portrait)).toEqual({ x: 0, y: 100, size: 200 });
  });

  it('shrinks the square as the zoom grows', () => {
    expect(photoCropRect({ zoom: 2, centerX: 0.5, centerY: 0.5 }, landscape)).toEqual({ x: 150, y: 50, size: 100 });
  });
});

describe('clampPhotoCrop', () => {
  it('keeps the zoom between 1 and the maximum', () => {
    expect(clampPhotoCrop({ ...DEFAULT_PHOTO_CROP, zoom: 0.5 }, landscape).zoom).toBe(1);
    expect(clampPhotoCrop({ ...DEFAULT_PHOTO_CROP, zoom: 10 }, landscape).zoom).toBe(PHOTO_CROP_MAX_ZOOM);
  });

  it('keeps the crop square inside the image, so no empty edge is saved', () => {
    const crop = clampPhotoCrop({ zoom: 1, centerX: 0, centerY: 1 }, landscape);

    expect(photoCropRect(crop, landscape)).toEqual({ x: 0, y: 0, size: 200 });
  });

  it('leaves a crop that already fits unchanged', () => {
    const crop = { zoom: 2, centerX: 0.3, centerY: 0.6 };

    expect(clampPhotoCrop(crop, landscape)).toEqual(crop);
  });
});

describe('canPanPhotoCrop', () => {
  const square = { width: 600, height: 600 };

  it('lets a non-square photo move along its longer side at zoom 1', () => {
    expect(canPanPhotoCrop(DEFAULT_PHOTO_CROP, landscape)).toBe(true);
    expect(canPanPhotoCrop(DEFAULT_PHOTO_CROP, portrait)).toBe(true);
  });

  it('keeps a square photo still until it is zoomed in', () => {
    expect(canPanPhotoCrop(DEFAULT_PHOTO_CROP, square)).toBe(false);
    expect(canPanPhotoCrop({ ...DEFAULT_PHOTO_CROP, zoom: 1.2 }, square)).toBe(true);
  });

  it('treats a photo less than a pixel from square as square', () => {
    expect(canPanPhotoCrop(DEFAULT_PHOTO_CROP, { width: 600, height: 600.4 })).toBe(false);
  });
});

describe('zoomPhotoCrop', () => {
  it('pulls the center back inside the image when zooming out near an edge', () => {
    const zoomedIn = { zoom: 2, centerX: 0.15, centerY: 0.5 };

    expect(zoomPhotoCrop(zoomedIn, landscape, 1)).toEqual({ zoom: 1, centerX: 0.25, centerY: 0.5 });
  });
});

describe('panPhotoCrop', () => {
  it('moves the crop opposite to the drag, scaled from screen to image pixels', () => {
    // A 200px frame shows 200 image pixels at zoom 1: dragging right 40px reveals 40px more on the left.
    const crop = panPhotoCrop(DEFAULT_PHOTO_CROP, landscape, 40, 0, 200);

    expectRect(photoCropRect(crop, landscape), { x: 60, y: 0, size: 200 });
  });

  it('moves fewer image pixels per screen pixel when zoomed in', () => {
    const zoomed = { zoom: 2, centerX: 0.5, centerY: 0.5 };
    const crop = panPhotoCrop(zoomed, landscape, 0, -20, 200);

    // The frame shows 100 image pixels, so a 20px drag up moves the crop 10px down.
    expectRect(photoCropRect(crop, landscape), { x: 150, y: 60, size: 100 });
  });

  it('stops at the edge of the image', () => {
    const crop = panPhotoCrop(DEFAULT_PHOTO_CROP, landscape, -1000, 1000, 200);

    expect(photoCropRect(crop, landscape)).toEqual({ x: 200, y: 0, size: 200 });
  });
});

describe('photoCropImageStyle', () => {
  it('positions the image so the frame shows exactly the crop', () => {
    expect(photoCropImageStyle(DEFAULT_PHOTO_CROP, landscape)).toEqual({
      width: '200%',
      height: '100%',
      left: '-50%',
      top: '0%',
    });
  });
});

describe('cropPhoto', () => {
  const drawImage = jest.fn();
  const fillRect = jest.fn();
  let toBlobResult: Blob | null;

  /** The canvas cropPhoto drew on: the `this` of its getContext call. */
  function drawnCanvas() {
    return jest.mocked(HTMLCanvasElement.prototype.getContext).mock.contexts[0] as HTMLCanvasElement;
  }

  function sourceImage(width: number, height: number) {
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: width });
    Object.defineProperty(image, 'naturalHeight', { value: height });
    return image;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    toBlobResult = new Blob(['jpeg'], { type: 'image/jpeg' });
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      { drawImage, fillRect } as unknown as CanvasRenderingContext2D,
    );
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type, quality) => {
      expect([type, quality]).toEqual(['image/jpeg', 0.9]);
      callback(toBlobResult);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the crop into a square JPEG named after the original', async () => {
    const image = sourceImage(4000, 2000);

    const file = await cropPhoto(image, { zoom: 2, centerX: 0.5, centerY: 0.5 }, 'mali.photo.png');

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('mali.photo.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(drawnCanvas().width).toBe(PHOTO_CROP_OUTPUT_SIZE);
    expect(drawnCanvas().height).toBe(PHOTO_CROP_OUTPUT_SIZE);
    // Painted white first so transparent PNG areas do not turn black.
    expect(fillRect).toHaveBeenCalledWith(0, 0, PHOTO_CROP_OUTPUT_SIZE, PHOTO_CROP_OUTPUT_SIZE);
    expect(drawImage).toHaveBeenCalledWith(image, 1500, 500, 1000, 1000, 0, 0, PHOTO_CROP_OUTPUT_SIZE, PHOTO_CROP_OUTPUT_SIZE);
  });

  it('does not upscale a crop smaller than the output size', async () => {
    await cropPhoto(sourceImage(300, 200), DEFAULT_PHOTO_CROP, 'small.webp');

    expect(drawnCanvas().width).toBe(200);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 200, 200, 0, 0, 200, 200);
  });

  it('clamps a crop that no longer fits before drawing', async () => {
    await cropPhoto(sourceImage(400, 200), { zoom: 1, centerX: 1, centerY: 0.5 }, 'edge.png');

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 200, 0, 200, 200, 0, 0, 200, 200);
  });

  it('gives a file without an extension a .jpg name', async () => {
    const file = await cropPhoto(sourceImage(100, 100), DEFAULT_PHOTO_CROP, 'photo');

    expect(file.name).toBe('photo.jpg');
  });

  it('fails clearly when the browser cannot encode the image', async () => {
    toBlobResult = null;

    await expect(cropPhoto(sourceImage(100, 100), DEFAULT_PHOTO_CROP, 'a.png')).rejects.toThrow('This browser cannot crop photos.');
  });

  it('fails clearly without a 2D canvas', async () => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(cropPhoto(sourceImage(100, 100), DEFAULT_PHOTO_CROP, 'a.png')).rejects.toThrow('This browser cannot crop photos.');
  });
});
