import type { Database } from '@/shared/types/database.types';

/** The pet_species enum is the single vocabulary for pets.species and
 * listings.accepted_pet_types (ADR 0006). Labels are display-only. */
export type PetSpecies = Database['public']['Enums']['pet_species'];

export interface PetSpeciesOption {
  value: PetSpecies;
  label: string;
}

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

const PET_SPECIES_VALUES = new Set<string>(Object.keys(PET_SPECIES_LABELS));

export function isPetSpecies(value: string): value is PetSpecies {
  return PET_SPECIES_VALUES.has(value);
}

export const PET_SPECIES_OPTIONS: readonly PetSpeciesOption[] = (
  ['dog', 'cat', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'exotic_mammal', 'bird', 'other'] as const
).map((value) => ({ value, label: PET_SPECIES_LABELS[value] }));
