import type { Database } from '@/shared/types/database.types';

export type PetSpecies = Database['public']['Enums']['pet_species'];

export interface PetTypeOption {
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

export const PET_TYPE_OPTIONS: readonly PetTypeOption[] = (
  ['dog', 'cat', 'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'exotic_mammal', 'bird', 'other'] as const
).map((value) => ({ value, label: PET_SPECIES_LABELS[value] }));

export function serializeFacilities(facilities: string): string | null {
  const cleaned = facilities.trim();
  return cleaned.length > 0 ? cleaned : null;
}
