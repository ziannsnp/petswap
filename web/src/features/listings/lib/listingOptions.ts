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

export const FACILITY_OPTIONS = [
  'Lawn',
  'Air-conditioned room',
  'Security cameras',
  'Enclosed fence',
  'Daily photo updates',
  'Near a veterinary clinic',
] as const;

export type Facility = typeof FACILITY_OPTIONS[number];

export function serializeFacilities(facilities: readonly Facility[]): string | null {
  return facilities.length > 0 ? facilities.join('\n') : null;
}

export function parseFacilities(stored: string | null): string[] {
  if (!stored) return [];
  return stored.split('\n').map((facility) => facility.trim()).filter(Boolean);
}
