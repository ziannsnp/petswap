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
