import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { PET_SPECIES_OPTIONS, type PetSpecies } from '@/shared/lib/petSpecies';
import { EMPTY_PET_FORM_VALUES, parsePetForm, type PetFormErrors, type PetFormValues } from '../lib/petForm';
import type { UpdatePetValues } from '../lib/petApi';
import { PET_PHOTO_MAX_BYTES, PET_PHOTO_MIME_TYPES, validatePetPhoto } from '../lib/petPhoto';
import type { PhotoCrop } from '@/shared/lib/photoCrop';
import { PetAvatar } from './PetAvatar';
import { PhotoCropDialog } from '@/shared/components/PhotoCropDialog';

interface PetFormProps {
  initialValues?: PetFormValues;
  /** True when the pet already has a stored photo, even while its URL is still loading. */
  hasSavedPhoto?: boolean;
  /** Signed URL of the stored photo, used for the preview. */
  savedPhotoUrl?: string;
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  /** Shown above the actions when the last save failed; the caller owns the wording. */
  submitError: string | null;
  /** `photo` is set only for a newly chosen photo, and `removePhoto` only when a stored photo
   * should be removed, so leaving the picker alone keeps the current photo. */
  onSubmit: (values: UpdatePetValues) => void;
  onCancel: () => void;
  /** Called on every edit so the caller can clear a stale submit error. */
  onEdit?: () => void;
}

const labelClassName = 'mb-2 block text-sm font-medium text-gray-700';

function inputClassName(hasError: boolean) {
  return `input-field ${hasError ? 'input-field--error' : ''}`;
}

function RequiredMark() {
  return <span className="text-red-700" aria-hidden="true">*</span>;
}

/** Shared by pet creation and pet editing, so both enforce the same rules. */
const PHOTO_ACCEPT = PET_PHOTO_MIME_TYPES.join(',');
const PHOTO_MAX_MB = PET_PHOTO_MAX_BYTES / 1_048_576;

/** An original photo and the crop last applied to it, kept so the owner can adjust the crop. */
interface PhotoSource {
  file: File;
  crop?: PhotoCrop;
}

export function PetForm({
  initialValues = EMPTY_PET_FORM_VALUES,
  hasSavedPhoto = false,
  savedPhotoUrl,
  submitLabel,
  pendingLabel,
  isSubmitting,
  submitError,
  onSubmit,
  onCancel,
  onEdit,
}: PetFormProps) {
  const [values, setValues] = useState<PetFormValues>(initialValues);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  /** The cropped photo that will be uploaded. */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource | null>(null);
  /** Set while the crop dialog is open. */
  const [cropTarget, setCropTarget] = useState<PhotoSource | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removeSavedPhoto, setRemoveSavedPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const parsed = parsePetForm(values);
  // Errors stay hidden until the first submit so an untouched form is not all red.
  const errors: PetFormErrors = hasSubmitted && !parsed.ok ? parsed.errors : {};

  const hasInitialCareInfo = Boolean(
    initialValues.feeding_instruction ||
    initialValues.medical_note ||
    initialValues.behavior_note ||
    initialValues.allergies ||
    initialValues.vaccination_info ||
    initialValues.special_requirement,
  );
  const [isCareOpen, setIsCareOpen] = useState(hasInitialCareInfo);

  const hasCareErrors = Boolean(
    errors.feeding_instruction ||
    errors.medical_note ||
    errors.behavior_note ||
    errors.allergies ||
    errors.vaccination_info ||
    errors.special_requirement,
  );

  useEffect(() => {
    if (hasSubmitted && hasCareErrors) {
      setIsCareOpen(true);
    }
  }, [hasSubmitted, hasCareErrors]);

  // Revokes the previous blob URL whenever it is replaced, and on unmount.
  useEffect(() => {
    if (!photoPreviewUrl) return;
    return () => URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  const showsSavedPhoto = hasSavedPhoto && !removeSavedPhoto;
  const hasPhoto = Boolean(photoFile) || showsSavedPhoto;
  const photoSrc = photoPreviewUrl ?? (showsSavedPhoto ? savedPhotoUrl : null);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset now so choosing the same file again still fires this handler.
    event.target.value = '';
    if (!file) return;

    onEdit?.();
    const error = validatePetPhoto(file);
    // A rejected file never replaces the photo already shown.
    setPhotoError(error);
    if (error) return;

    setCropTarget({ file });
  };

  // Cancelling the crop keeps whatever photo was shown before the file was chosen.
  const handleCropConfirm = (croppedPhoto: File, crop: PhotoCrop) => {
    if (!cropTarget) return;
    onEdit?.();
    setPhotoFile(croppedPhoto);
    setPhotoPreviewUrl(URL.createObjectURL(croppedPhoto));
    setPhotoSource({ file: cropTarget.file, crop });
    setRemoveSavedPhoto(false);
    setCropTarget(null);
  };

  const handleRemovePhoto = () => {
    onEdit?.();
    setPhotoFile(null);
    setPhotoSource(null);
    setPhotoPreviewUrl(null);
    setRemoveSavedPhoto(hasSavedPhoto);
    setPhotoError(null);
  };

  const update = <K extends keyof PetFormValues>(field: K, value: PetFormValues[K]) => {
    onEdit?.();
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!parsed.ok) return;

    if (photoFile) {
      onSubmit({ ...parsed.values, photo: photoFile });
    } else if (removeSavedPhoto) {
      onSubmit({ ...parsed.values, removePhoto: true });
    } else {
      onSubmit(parsed.values);
    }
  };

  const describedBy = (field: keyof PetFormValues, hintId?: string) =>
    [hintId, errors[field] ? `pet-${field}-error` : null].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: keyof PetFormValues) => errors[field] && (
    <p className="form-error" id={`pet-${field}-error`}>{errors[field]}</p>
  );

  return (
    <form className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <PetAvatar
          src={photoSrc}
          alt={photoFile ? 'Preview of the chosen pet photo' : 'Current pet photo'}
          className="h-24 w-24"
          iconClassName="h-10 w-10"
        />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-sm font-medium text-gray-700">
            Photo <span className="font-normal text-gray-500">(optional)</span>
          </p>
          <p className="form-hint" id="pet-photo-help">JPG, PNG, WebP, or GIF, up to {PHOTO_MAX_MB} MB.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              className="btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              aria-describedby={['pet-photo-help', photoError ? 'pet-photo-error' : null].filter(Boolean).join(' ')}
            >
              {hasPhoto ? 'Change photo' : 'Choose photo'}
            </button>
            {/* Only a photo chosen in this session can be re-cropped: the stored one is
                already cropped, and its original was never uploaded. */}
            {photoFile && photoSource && (
              <button
                className="btn-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => setCropTarget(photoSource)}
                disabled={isSubmitting}
              >
                Adjust crop
              </button>
            )}
            {hasPhoto && (
              <button
                className="btn-secondary min-h-11 text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={handleRemovePhoto}
                disabled={isSubmitting}
              >
                Remove photo
              </button>
            )}
          </div>
          {/* Announced right away: the error follows choosing a file, not pressing Save. */}
          {photoError && <p className="form-error" id="pet-photo-error" role="alert">{photoError}</p>}
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={handlePhotoChange}
            disabled={isSubmitting}
            aria-label="Pet photo"
          />
        </div>
      </div>

      {cropTarget && (
        <PhotoCropDialog
          file={cropTarget.file}
          initialCrop={cropTarget.crop}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropTarget(null)}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="pet-name">Name <RequiredMark /></label>
          <input
            className={inputClassName(Boolean(errors.name))}
            id="pet-name"
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy('name')}
          />
          {fieldError('name')}
        </div>

        <div>
          <label className={labelClassName} htmlFor="pet-species">Species <RequiredMark /></label>
          <select
            className={inputClassName(Boolean(errors.species))}
            id="pet-species"
            value={values.species}
            onChange={(event) => update('species', event.target.value as PetSpecies | '')}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.species)}
            aria-describedby={describedBy('species')}
          >
            <option value="" disabled>Choose a species</option>
            {PET_SPECIES_OPTIONS.map(({ value, label }) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          {fieldError('species')}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="pet-breed">
            Breed <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <input
            className="input-field"
            id="pet-breed"
            value={values.breed}
            onChange={(event) => update('breed', event.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
            placeholder="For example, Golden Retriever"
          />
        </div>

        <div>
          <label className={labelClassName} htmlFor="pet-age">
            Age in years <span className="font-normal text-gray-500">(optional)</span>
          </label>
          {/* A text input keeps "1.5" or "abc" visible to validation; a number input
              would silently report invalid text as an empty value. */}
          <input
            className={inputClassName(Boolean(errors.age))}
            id="pet-age"
            inputMode="numeric"
            value={values.age}
            onChange={(event) => update('age', event.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
            placeholder="For example, 3"
            aria-invalid={Boolean(errors.age)}
            aria-describedby={describedBy('age', 'pet-age-help')}
          />
          <p className="form-hint" id="pet-age-help">Use 0 for pets under one year old.</p>
          {fieldError('age')}
        </div>
      </div>

      <div>
        <label className={labelClassName} htmlFor="pet-description">Description <RequiredMark /></label>
        <textarea
          className={inputClassName(Boolean(errors.description))}
          id="pet-description"
          rows={4}
          value={values.description}
          onChange={(event) => update('description', event.target.value)}
          disabled={isSubmitting}
          placeholder="Personality, routine, and anything a sitter should know"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy('description')}
        />
        {fieldError('description')}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-6"
          onClick={() => setIsCareOpen((open) => !open)}
          aria-expanded={isCareOpen}
          aria-controls="pet-care-section"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">
              Care information <span className="font-normal text-gray-500">(optional)</span>
            </span>
            <span className="text-xs text-gray-500">
              Feeding routines, medical notes, allergies, and special requirements
            </span>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isCareOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {isCareOpen && (
          <div
            id="pet-care-section"
            className="space-y-4 border-t border-gray-200 px-4 py-4 sm:px-6"
          >
            <div>
              <label className={labelClassName} htmlFor="pet-feeding-instruction">
                Feeding instructions <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                className={inputClassName(Boolean(errors.feeding_instruction))}
                id="pet-feeding-instruction"
                rows={3}
                value={values.feeding_instruction ?? ''}
                onChange={(event) => update('feeding_instruction', event.target.value)}
                disabled={isSubmitting}
                placeholder="Portion sizes, schedule, and dietary restrictions"
                aria-invalid={Boolean(errors.feeding_instruction)}
                aria-describedby={describedBy('feeding_instruction')}
              />
              {fieldError('feeding_instruction')}
            </div>

            <div>
              <label className={labelClassName} htmlFor="pet-medical-note">
                Medical notes <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                className={inputClassName(Boolean(errors.medical_note))}
                id="pet-medical-note"
                rows={3}
                value={values.medical_note ?? ''}
                onChange={(event) => update('medical_note', event.target.value)}
                disabled={isSubmitting}
                placeholder="Medications, chronic conditions, and vet instructions"
                aria-invalid={Boolean(errors.medical_note)}
                aria-describedby={describedBy('medical_note')}
              />
              {fieldError('medical_note')}
            </div>

            <div>
              <label className={labelClassName} htmlFor="pet-behavior-note">
                Behavior notes <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                className={inputClassName(Boolean(errors.behavior_note))}
                id="pet-behavior-note"
                rows={3}
                value={values.behavior_note ?? ''}
                onChange={(event) => update('behavior_note', event.target.value)}
                disabled={isSubmitting}
                placeholder="Temperament, fears, habits, or interaction with other pets"
                aria-invalid={Boolean(errors.behavior_note)}
                aria-describedby={describedBy('behavior_note')}
              />
              {fieldError('behavior_note')}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClassName} htmlFor="pet-allergies">
                  Allergies <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  className={inputClassName(Boolean(errors.allergies))}
                  id="pet-allergies"
                  rows={3}
                  value={values.allergies ?? ''}
                  onChange={(event) => update('allergies', event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Known food or environmental allergies"
                  aria-invalid={Boolean(errors.allergies)}
                  aria-describedby={describedBy('allergies')}
                />
                {fieldError('allergies')}
              </div>

              <div>
                <label className={labelClassName} htmlFor="pet-vaccination-info">
                  Vaccination information <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <textarea
                  className={inputClassName(Boolean(errors.vaccination_info))}
                  id="pet-vaccination-info"
                  rows={3}
                  value={values.vaccination_info ?? ''}
                  onChange={(event) => update('vaccination_info', event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Vaccination status and history"
                  aria-invalid={Boolean(errors.vaccination_info)}
                  aria-describedby={describedBy('vaccination_info')}
                />
                {fieldError('vaccination_info')}
              </div>
            </div>

            <div>
              <label className={labelClassName} htmlFor="pet-special-requirement">
                Special requirements <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                className={inputClassName(Boolean(errors.special_requirement))}
                id="pet-special-requirement"
                rows={3}
                value={values.special_requirement ?? ''}
                onChange={(event) => update('special_requirement', event.target.value)}
                disabled={isSubmitting}
                placeholder="Any other specific care needs or accommodations"
                aria-invalid={Boolean(errors.special_requirement)}
                aria-describedby={describedBy('special_requirement')}
              />
              {fieldError('special_requirement')}
            </div>
          </div>
        )}
      </div>

      {submitError && <p className="form-alert" role="alert">{submitError}</p>}

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
        <button
          className="btn-secondary min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          className="btn-primary flex min-h-11 flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting && <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {isSubmitting ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
