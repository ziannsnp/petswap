import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowLeft, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { validateListingForm } from '../lib/listingForm';
import type { ListingFormErrors } from '../lib/listingForm';
import { FACILITY_OPTIONS, PET_TYPE_OPTIONS } from '../lib/listingOptions';
import type { PetSpecies } from '../lib/listingOptions';
import { partitionListingPhotos } from '../lib/listingPhotos';
import type { RejectedListingPhoto } from '../lib/listingPhotos';
import { ListingsNavigation } from './ListingsNavigation';

const labelClassName = 'mb-2 block text-sm font-medium text-gray-700';

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

function inputClassName(hasError: boolean) {
  return `input-field ${hasError ? 'border-red-500 focus:ring-red-300' : ''}`;
}

function toggleChoice<T extends string>(value: T, selected: T[], update: (next: T[]) => void) {
  update(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
}

export function CreateListingScreen() {
  const navigate = useNavigate();
  const previewUrls = useRef<string[]>([]);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState<number | ''>(1);
  const [acceptedPetTypes, setAcceptedPetTypes] = useState<PetSpecies[]>(['dog']);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [rejectedPhotos, setRejectedPhotos] = useState<RejectedListingPhoto[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const values = { title, location, description, capacity };
  // Errors stay derived so correcting a field clears its message as the owner types,
  // while nothing is reported until they have tried to save at least once.
  const errors: ListingFormErrors = hasSubmitted ? validateListingForm(values) : {};

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handlePhotoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const { accepted, rejected } = partitionListingPhotos(
      Array.from(event.target.files ?? []),
      photos.length,
    );
    setRejectedPhotos(rejected);

    const selectedPhotos = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      return { file, previewUrl };
    });
    setPhotos((current) => [...current, ...selectedPhotos]);
    event.target.value = '';
  };

  const removePhoto = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== previewUrl);
    setPhotos((current) => current.filter((photo) => photo.previewUrl !== previewUrl));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowSuccess(false);
    setHasSubmitted(true);

    if (Object.keys(validateListingForm(values)).length > 0) return;

    setIsSaving(true);
    // TODO(T-2.1.5): Replace this UI-only delay with the create-listing mutation.
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setIsSaving(false);
    setShowSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <ListingsNavigation />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700" to="/listings">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to my listings
        </Link>
        <div className="mb-6 mt-4">
          <p className="mb-1 text-xs font-bold uppercase text-brand-700">Hosting</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Create a new listing</h1>
        </div>

        <form className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit} noValidate>
          <div>
            <label className={labelClassName} htmlFor="listing-title">Listing title <span className="text-red-700" aria-hidden="true">*</span></label>
            <input
              className={inputClassName(Boolean(errors.title))}
              id="listing-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="For example, Quiet home near the park"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'listing-title-error' : undefined}
            />
            {errors.title && <p className="mt-1 text-xs text-red-700" id="listing-title-error">{errors.title}</p>}
          </div>

          <div>
            <label className={labelClassName} htmlFor="listing-location">Location <span className="text-red-700" aria-hidden="true">*</span></label>
            <input
              className={inputClassName(Boolean(errors.location))}
              id="listing-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="For example, Chiang Mai, Hang Dong"
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? 'listing-location-error' : undefined}
            />
            {errors.location && <p className="mt-1 text-xs text-red-700" id="listing-location-error">{errors.location}</p>}
          </div>

          <div>
            <label className={labelClassName} htmlFor="listing-description">Description <span className="text-red-700" aria-hidden="true">*</span></label>
            <textarea
              className={inputClassName(Boolean(errors.description))}
              id="listing-description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the space and the care you can provide"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'listing-description-error' : undefined}
            />
            {errors.description && <p className="mt-1 text-xs text-red-700" id="listing-description-error">{errors.description}</p>}
          </div>

          <div className="max-w-xs">
            <label className={labelClassName} htmlFor="listing-capacity">Capacity <span className="text-red-700" aria-hidden="true">*</span></label>
            <input
              className={inputClassName(Boolean(errors.capacity))}
              id="listing-capacity"
              type="number"
              min="1"
              step="1"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value === '' ? '' : Number(event.target.value))}
              aria-invalid={Boolean(errors.capacity)}
              aria-describedby={errors.capacity
                ? 'listing-capacity-help listing-capacity-error'
                : 'listing-capacity-help'}
            />
            <p className="mt-1 text-xs text-gray-500" id="listing-capacity-help">Maximum number of pets hosted at one time.</p>
            {errors.capacity && <p className="mt-1 text-xs text-red-700" id="listing-capacity-error">{errors.capacity}</p>}
          </div>

          <fieldset>
            <legend className={labelClassName}>Accepted pet types</legend>
            <div className="flex flex-wrap gap-2">
              {PET_TYPE_OPTIONS.map(({ value, label }) => {
                const isSelected = acceptedPetTypes.includes(value);
                return (
                  <button
                    className={`min-h-10 rounded-lg border px-4 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-brand-500 hover:bg-brand-50'
                    }`}
                    type="button"
                    key={value}
                    aria-pressed={isSelected}
                    onClick={() => toggleChoice(value, acceptedPetTypes, setAcceptedPetTypes)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClassName}>Facilities</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FACILITY_OPTIONS.map((facility) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600" key={facility}>
                  <input
                    className="h-4 w-4 accent-brand-600"
                    type="checkbox"
                    checked={facilities.includes(facility)}
                    onChange={() => toggleChoice(facility, facilities, setFacilities)}
                  />
                  <span className="break-words">{facility}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <span className={labelClassName}>Photos</span>
            {photos.length === 0 ? (
              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 px-4 text-center text-gray-500 hover:border-brand-500 hover:bg-brand-50"
                htmlFor="listing-photos"
              >
                <ImagePlus className="mb-1 h-8 w-8 text-brand-600" aria-hidden="true" />
                <strong className="text-sm font-medium text-gray-700">Add listing photos</strong>
                <span className="text-xs">Choose JPG, PNG, WebP, or GIF files</span>
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div className="relative aspect-4/3 overflow-hidden rounded-lg border border-gray-200" key={photo.previewUrl}>
                    <img className="h-full w-full object-cover" src={photo.previewUrl} alt={photo.file.name} />
                    <button
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-700 hover:bg-red-50"
                      type="button"
                      onClick={() => removePhoto(photo.previewUrl)}
                      aria-label={`Remove ${photo.file.name}`}
                      title="Remove photo"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <label
                  className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-sm text-brand-700 hover:border-brand-500 hover:bg-brand-50"
                  htmlFor="listing-photos"
                  title="Add more photos"
                >
                  <ImagePlus className="h-7 w-7" aria-hidden="true" />
                  <span>Add more</span>
                </label>
              </div>
            )}
            <input
              className="sr-only"
              id="listing-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handlePhotoSelection}
            />
            {rejectedPhotos.length > 0 && (
              <ul className="mt-2 space-y-1" role="alert">
                {rejectedPhotos.map((rejected, index) => (
                  <li className="text-xs text-red-700" key={`${rejected.fileName}-${index}`}>
                    {rejected.fileName}: {rejected.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {showSuccess && (
            <p className="border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
              Listing details checked successfully.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <button className="btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => navigate('/listings')} disabled={isSaving}>Cancel</button>
            <button className="btn-primary order-first flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 sm:order-none" type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isSaving && <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {isSaving ? 'Saving...' : 'Save listing'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
