import { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ClipboardList,
  Pill,
  SquarePen,
  Syringe,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import { usePetPhotoUrl } from '../hooks/usePets';
import type { Pet } from '../lib/petApi';
import { DeletePetDialog } from './DeletePetDialog';
import { PetAvatar } from './PetAvatar';

interface PetCardProps {
  pet: Pet;
}

interface CareFieldConfig {
  key: keyof Pick<
    Pet,
    | 'feeding_instruction'
    | 'medical_note'
    | 'behavior_note'
    | 'allergies'
    | 'vaccination_info'
    | 'special_requirement'
  >;
  label: string;
  icon: typeof Utensils;
  colors: {
    bg: string;
    text: string;
    title: string;
  };
}

const CARE_FIELD_CONFIGS: readonly CareFieldConfig[] = [
  {
    key: 'feeding_instruction',
    label: 'Feeding instructions',
    icon: Utensils,
    colors: { bg: 'bg-amber-50', text: 'text-amber-700', title: 'text-amber-800' },
  },
  {
    key: 'medical_note',
    label: 'Medical notes',
    icon: Pill,
    colors: { bg: 'bg-emerald-50', text: 'text-emerald-700', title: 'text-emerald-800' },
  },
  {
    key: 'behavior_note',
    label: 'Behavior notes',
    icon: Activity,
    colors: { bg: 'bg-purple-50', text: 'text-purple-700', title: 'text-purple-800' },
  },
  {
    key: 'allergies',
    label: 'Allergies',
    icon: AlertCircle,
    colors: { bg: 'bg-red-50', text: 'text-red-700', title: 'text-red-800' },
  },
  {
    key: 'vaccination_info',
    label: 'Vaccination information',
    icon: Syringe,
    colors: { bg: 'bg-blue-50', text: 'text-blue-700', title: 'text-blue-800' },
  },
  {
    key: 'special_requirement',
    label: 'Special requirements',
    icon: ClipboardList,
    colors: { bg: 'bg-teal-50', text: 'text-teal-700', title: 'text-teal-800' },
  },
];

function formatAge(ageYear: number | null): string | null {
  if (ageYear === null) return null;
  if (ageYear === 0) return 'Under 1 year old';
  return `${ageYear} ${ageYear === 1 ? 'year' : 'years'} old`;
}

// The icon buttons follow the VibeCode card, with a 44px tap target and a name screen
// readers can announce, since the icons alone have no text.
const actionClassName = 'flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

export function PetCard({ pet }: PetCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Shows the paw placeholder while the signed URL loads, or when there is no photo.
  const { data: photoUrl } = usePetPhotoUrl(pet.photo_url);
  const age = formatAge(pet.age_year);
  const details = [petSpeciesLabel(pet.species), pet.breed, age].filter(Boolean).join(' · ');

  const careItems = CARE_FIELD_CONFIGS.map((config) => {
    const raw = pet[config.key];
    const value = raw?.trim();
    return value ? { ...config, value } : null;
  }).filter((item): item is (CareFieldConfig & { value: string }) => item !== null);

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-4">
          <PetAvatar src={photoUrl} className="h-16 w-16" iconClassName="h-7 w-7" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 break-words">{pet.name}</h2>
            <p className="text-sm text-gray-500 break-words">{details}</p>
          </div>
        </div>
        <div className="-mr-3 -mt-3 flex shrink-0">
          <Link
            className={`${actionClassName} hover:text-brand-600`}
            to={`/pets/${pet.id}/edit`}
            aria-label={`Edit ${pet.name}`}
          >
            <SquarePen className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            className={`${actionClassName} hover:text-red-600`}
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            aria-label={`Delete ${pet.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {pet.description && (
        <p className="mt-4 line-clamp-3 text-sm text-gray-600 break-words">{pet.description}</p>
      )}
      {careItems.length > 0 && (
        <section className="mt-4 border-t border-gray-100 pt-3" aria-label="Care information">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Care information
          </h3>
          <div className="space-y-2">
            {careItems.map(({ key, label, icon: Icon, colors, value }) => (
              <div key={key} className={`rounded-lg p-3 ${colors.bg}`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${colors.title}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </div>
                <p className={`mt-1 text-sm whitespace-pre-line break-words ${colors.text}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {/* Mounted only while open, so each card does not hold an idle delete mutation. */}
      {isDeleteDialogOpen && (
        <DeletePetDialog pet={pet} isOpen onClose={() => setIsDeleteDialogOpen(false)} />
      )}
    </article>
  );
}
