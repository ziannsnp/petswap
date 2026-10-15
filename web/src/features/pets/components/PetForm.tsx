import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { PET_SPECIES_OPTIONS, type PetSpecies } from '@/shared/lib/petSpecies';
import { EMPTY_PET_FORM_VALUES, parsePetForm, type PetFormErrors, type PetFormValues } from '../lib/petForm';
import type { CreatePetValues } from '../lib/petApi';

interface PetFormProps {
  initialValues?: PetFormValues;
  submitLabel: string;
  pendingLabel: string;
  isSubmitting: boolean;
  /** Shown above the actions when the last save failed; the caller owns the wording. */
  submitError: string | null;
  onSubmit: (values: CreatePetValues) => void;
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

/** Shared by pet creation and (later) pet editing, so both enforce the same rules. */
export function PetForm({
  initialValues = EMPTY_PET_FORM_VALUES,
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
  const parsed = parsePetForm(values);
  // Errors stay hidden until the first submit so an untouched form is not all red.
  const errors: PetFormErrors = hasSubmitted && !parsed.ok ? parsed.errors : {};

  const update = <K extends keyof PetFormValues>(field: K, value: PetFormValues[K]) => {
    onEdit?.();
    setValues((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (parsed.ok) onSubmit(parsed.values);
  };

  const describedBy = (field: keyof PetFormValues, hintId?: string) =>
    [hintId, errors[field] ? `pet-${field}-error` : null].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: keyof PetFormValues) => errors[field] && (
    <p className="form-error" id={`pet-${field}-error`}>{errors[field]}</p>
  );

  return (
    <form className="space-y-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit} noValidate>
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
