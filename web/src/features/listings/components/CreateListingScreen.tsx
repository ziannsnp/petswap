import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowLeft, ImagePlus, LoaderCircle, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { validateListingForm } from '../lib/listingForm';
import type { ListingFormErrors } from '../lib/listingForm';
import { useCreateListing } from '../hooks/useCreateListing';
import { FACILITY_OPTIONS, PET_TYPE_OPTIONS } from '../lib/listingOptions';
import { partitionListingPhotos } from '../lib/listingPhotos';
import type { RejectedListingPhoto } from '../lib/listingPhotos';
import { ListingsNavigation } from './ListingsNavigation';
import type { Facility, PetSpecies } from '../lib/listingOptions';

const labelClassName = 'mb-2 block text-sm font-medium text-gray-700';

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

function inputClassName(hasError: boolean) {
  return `input-field ${hasError ? 'border-red-500 focus:ring-red-300' : ''}`;
}

function firstAvailablePetType(selected: PetSpecies[]): PetSpecies {
  return PET_TYPE_OPTIONS.find(({ value }) => !selected.includes(value))?.value ?? PET_TYPE_OPTIONS[0].value;
}

export function CreateListingScreen() {
  const navigate = useNavigate();
  const previewUrls = useRef<string[]>([]);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState<number | ''>(1);
  const [acceptedPetTypes, setAcceptedPetTypes] = useState<PetSpecies[]>(['dog']);
  const [petTypeToAdd, setPetTypeToAdd] = useState<PetSpecies>('cat');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [rejectedPhotos, setRejectedPhotos] = useState<RejectedListingPhoto[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionIntent, setSubmissionIntent] = useState<'draft' | 'published' | null>(null);
  const createListingMutation = useCreateListing();
  const isSubmitting = submissionIntent !== null || createListingMutation.isPending;
  const values = { title, location, description, capacity, acceptedPetTypes };
  const errors: ListingFormErrors = hasSubmitted ? validateListingForm(values) : {};

  const resetMutationError = () => {
    if (createListingMutation.isError) createListingMutation.reset();
  };

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handlePhotoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    resetMutationError();
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
    resetMutationError();
    URL.revokeObjectURL(previewUrl);
    previewUrls.current = previewUrls.current.filter((url) => url !== previewUrl);
    setPhotos((current) => current.filter((photo) => photo.previewUrl !== previewUrl));
    setRejectedPhotos((current) => current.filter((rejected) => rejected.kind !== 'capacity'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const publicationMode = submitter?.value === 'draft' ? 'draft' : 'published';
    setHasSubmitted(true);
    const nextErrors = validateListingForm(values);

    if (Object.keys(nextErrors).length > 0) return;
    if (capacity === '') return;

    setSubmissionIntent(publicationMode);
    try {
      await createListingMutation.mutateAsync({
        title,
        location,
        description,
        capacity,
        acceptedPetTypes,
        facilities,
        photos: photos.map((photo) => photo.file),
        publicationMode,
      });
      void navigate('/listings', { state: { listingSaved: publicationMode } });
    } catch {
      return;
    } finally {
      setSubmissionIntent(null);
    }
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
              onChange={(event) => { resetMutationError(); setTitle(event.target.value); }}
              disabled={isSubmitting}
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
              onChange={(event) => { resetMutationError(); setLocation(event.target.value); }}
              disabled={isSubmitting}
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
              onChange={(event) => { resetMutationError(); setDescription(event.target.value); }}
              disabled={isSubmitting}
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
              onChange={(event) => {
                resetMutationError();
                setCapacity(event.target.value === '' ? '' : Number(event.target.value));
              }}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.capacity)}
              aria-describedby={errors.capacity
                ? 'listing-capacity-help listing-capacity-error'
                : 'listing-capacity-help'}
            />
            <p className="mt-1 text-xs text-gray-500" id="listing-capacity-help">Maximum number of pets hosted at one time.</p>
            {errors.capacity && <p className="mt-1 text-xs text-red-700" id="listing-capacity-error">{errors.capacity}</p>}
          </div>

          <fieldset>
            <legend className={labelClassName}>Accepted pet types <span className="text-red-700" aria-hidden="true">*</span></legend>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                className="input-field sm:max-w-xs"
                id="accepted-pet-type"
                value={petTypeToAdd}
                onChange={(event) => {
                  resetMutationError();
                  setPetTypeToAdd(event.target.value as PetSpecies);
                }}
                disabled={isSubmitting}
                aria-label="Accepted pet type"
              >
                {PET_TYPE_OPTIONS.map(({ value, label }) => (
                  <option value={value} key={value} disabled={acceptedPetTypes.includes(value)}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary inline-flex min-h-11 items-center justify-center gap-2"
                type="button"
                onClick={() => {
                  resetMutationError();
                  if (acceptedPetTypes.includes(petTypeToAdd)) return;
                  const nextPetTypes = [...acceptedPetTypes, petTypeToAdd];
                  setAcceptedPetTypes(nextPetTypes);
                  setPetTypeToAdd(firstAvailablePetType(nextPetTypes));
                }}
                disabled={isSubmitting || acceptedPetTypes.length === PET_TYPE_OPTIONS.length || acceptedPetTypes.includes(petTypeToAdd)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add type
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {acceptedPetTypes.map((value) => {
                const option = PET_TYPE_OPTIONS.find((item) => item.value === value);
                return option ? (
                  <button
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700"
                    type="button"
                    key={value}
                    disabled={isSubmitting}
                    onClick={() => {
                      resetMutationError();
                      const nextPetTypes = acceptedPetTypes.filter((petType) => petType !== value);
                      setAcceptedPetTypes(nextPetTypes);
                      setPetTypeToAdd(firstAvailablePetType(nextPetTypes));
                    }}
                    aria-label={`Remove ${option.label}`}
                  >
                    {option.label}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null;
              })}
            </div>
            {errors.acceptedPetTypes && <p className="mt-1 text-xs text-red-700">{errors.acceptedPetTypes}</p>}
          </fieldset>

          <fieldset>
            <legend className={labelClassName}>Facilities <span className="font-normal text-gray-500">(optional)</span></legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FACILITY_OPTIONS.map((facility) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600" key={facility}>
                  <input
                    className="h-4 w-4 rounded accent-brand-600"
                    type="checkbox"
                    checked={facilities.includes(facility)}
                    disabled={isSubmitting}
                    onChange={() => {
                      resetMutationError();
                      setFacilities((current) => current.includes(facility)
                        ? current.filter((item) => item !== facility)
                        : [...current, facility]);
                    }}
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
                      disabled={isSubmitting}
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
              disabled={isSubmitting}
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

          {createListingMutation.isError && (
            <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              We could not save your listing. Check your connection and try again.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
            <button className="btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => navigate('/listings')} disabled={isSubmitting}>Cancel</button>
            <button className="btn-secondary flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" name="publicationMode" value="draft" disabled={isSubmitting} aria-busy={submissionIntent === 'draft'}>
              {submissionIntent === 'draft' && <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submissionIntent === 'draft' ? 'Saving draft...' : 'Save draft'}
            </button>
            <button className="btn-primary order-first flex min-h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 sm:order-none" type="submit" name="publicationMode" value="published" disabled={isSubmitting} aria-busy={submissionIntent === 'published'}>
              {submissionIntent === 'published' && <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {submissionIntent === 'published' ? 'Publishing...' : 'Publish listing'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
