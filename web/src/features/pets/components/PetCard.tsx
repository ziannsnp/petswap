import { useState } from 'react';
import { SquarePen, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import { usePetPhotoUrl } from '../hooks/usePets';
import type { Pet } from '../lib/petApi';
import { DeletePetDialog } from './DeletePetDialog';
import { PetAvatar } from './PetAvatar';

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

export function PetCard({ pet }: PetCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Shows the paw placeholder while the signed URL loads, or when there is no photo.
  const { data: photoUrl } = usePetPhotoUrl(pet.photo_url);
  const age = formatAge(pet.age_year);
  const details = [petSpeciesLabel(pet.species), pet.breed, age].filter(Boolean).join(' · ');

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
      {/* Mounted only while open, so each card does not hold an idle delete mutation. */}
      {isDeleteDialogOpen && (
        <DeletePetDialog pet={pet} isOpen onClose={() => setIsDeleteDialogOpen(false)} />
      )}
    </article>
  );
}
