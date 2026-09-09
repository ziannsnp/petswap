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

export const PET_TYPE_OPTIONS: readonly PetTypeOption[] = Object.entries(
  PET_SPECIES_LABELS,
).map(([value, label]) => ({ value: value as PetSpecies, label }));
