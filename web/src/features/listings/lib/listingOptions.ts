import type { Database } from '@/shared/types/database.types';

export type PetSpecies = Database['public']['Enums']['pet_species'];

export interface PetTypeOption {
  value: PetSpecies;
  label: string;
}

/**
 * A listing stores the `pet_species` value so it can be compared with a pet's own
 * species (ADR 0006); these labels are display text and are never sent to Supabase.
 * Typing the map as a full Record makes adding an enum value a compile error here
 * rather than a listing that renders its raw database value.
 */
const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
  rabbit: 'Rabbit',
  hamster: 'Hamster',
  guinea_pig: 'Guinea pig',
  fish: 'Fish',
  reptile: 'Reptile',
  exotic_mammal: 'Exotic mammal',
  bird: 'Bird',
  other: 'Other',
};

export function petSpeciesLabel(species: PetSpecies): string {
  return PET_SPECIES_LABELS[species];
}

/** The create form offers the four types the prototype shows, not the whole enum. */
export const PET_TYPE_OPTIONS: readonly PetTypeOption[] = (
  ['dog', 'cat', 'rabbit', 'bird'] as const
).map((value) => ({ value, label: PET_SPECIES_LABELS[value] }));

/** The facilities the create and edit forms offer as checkboxes. */
export const FACILITY_OPTIONS: readonly string[] = [
  'Fenced yard',
  'Air conditioning',
  'Security cameras',
  'Indoor play area',
  'Daily photo updates',
  'Near a vet clinic',
];

/**
 * `listings.facilities` is a single plain-text column (FR-3.1, ADR 0006), so selections
 * are stored one per line. A newline cannot occur inside a facility label, which keeps
 * the split unambiguous where a comma would not.
 */
export function serializeFacilities(facilities: readonly string[]): string | null {
  const cleaned = facilities.map((facility) => facility.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join('\n') : null;
}

/**
 * Returns every stored facility, including any that is not in `FACILITY_OPTIONS`, so a
 * later edit re-serialises what it read instead of silently dropping a value that was
 * written by an earlier option list or by hand.
 */
export function parseFacilities(stored: string | null): string[] {
  if (!stored) return [];
  return stored.split('\n').map((facility) => facility.trim()).filter(Boolean);
}
