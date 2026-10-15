import { useState } from 'react';
import { PawPrint, SquarePen, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import type { Pet } from '../lib/petApi';
import { DeletePetDialog } from './DeletePetDialog';

interface PetCardProps {
  pet: Pet;
}

function formatAge(ageYear: number | null): string | null {
  if (ageYear === null) return null;
  if (ageYear === 0) return 'Under 1 year old';
  return `${ageYear} ${ageYear === 1 ? 'year' : 'years'} old`;
}

// The icon buttons follow the VibeCode card, with a 44px tap target and a name screen
// readers can announce, since the icons alone have no text.
const actionClassName = 'flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

// Photos are private storage paths that need signed URLs; until photo upload is wired
// in, every card shows the placeholder avatar.
export function PetCard({ pet }: PetCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const age = formatAge(pet.age_year);
  const details = [petSpeciesLabel(pet.species), pet.breed, age].filter(Boolean).join(' · ');

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-brand-100 bg-brand-50">
            <PawPrint className="h-7 w-7 text-brand-600" aria-hidden="true" />
          </div>
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
      <DeletePetDialog pet={pet} isOpen={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)} />
    </article>
  );
}
