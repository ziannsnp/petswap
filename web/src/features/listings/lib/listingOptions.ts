import type { Database } from '@/shared/types/database.types';

export type PetSpecies = Database['public']['Enums']['pet_species'];
export const FACILITY_SEPARATOR = '\n';

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

export const PET_TYPE_OPTIONS: readonly PetTypeOption[] = (
  ['dog', 'cat', 'rabbit', 'bird'] as const
).map((value) => ({ value, label: PET_SPECIES_LABELS[value] }));

export const FACILITY_OPTIONS: readonly string[] = [
  'Fenced yard',
  'Air conditioning',
  'Security cameras',
  'Indoor play area',
  'Daily photo updates',
  'Near a vet clinic',
];

export function serializeFacilities(facilities: readonly string[]): string | null {
  const cleaned = facilities.map((facility) => facility.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join('\n') : null;
}

export function parseFacilities(stored: string | null): string[] {
  if (!stored) return [];
  return stored.split('\n').map((facility) => facility.trim()).filter(Boolean);
}