import { PawPrint } from 'lucide-react';
import { petSpeciesLabel } from '@/shared/lib/petSpecies';
import type { Pet } from '../lib/petApi';

interface PetCardProps {
  pet: Pet;
}

function formatAge(ageYear: number | null): string | null {
  if (ageYear === null) return null;
  if (ageYear === 0) return 'Under 1 year old';
  return `${ageYear} ${ageYear === 1 ? 'year' : 'years'} old`;
}

// Photos are private storage paths that need signed URLs; until photo upload is wired
// in, every card shows the placeholder avatar.
export function PetCard({ pet }: PetCardProps) {
  const age = formatAge(pet.age_year);
  const details = [petSpeciesLabel(pet.species), pet.breed, age].filter(Boolean).join(' · ');

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-brand-100 bg-brand-50">
          <PawPrint className="h-7 w-7 text-brand-600" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 break-words">{pet.name}</h2>
          <p className="text-sm text-gray-500 break-words">{details}</p>
        </div>
      </div>
      {pet.description && (
        <p className="mt-4 line-clamp-3 text-sm text-gray-600 break-words">{pet.description}</p>
      )}
    </article>
  );
}
