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

/** `listings.facilities` is plain text (FR-3.1), so these labels are stored verbatim. */
export const FACILITY_OPTIONS: readonly string[] = [
  'Fenced yard',
  'Air conditioning',
  'Security cameras',
  'Indoor play area',
  'Daily photo updates',
  'Near a vet clinic',
];
