import {
  Activity,
  AlertCircle,
  ClipboardList,
  Pill,
  Syringe,
  Utensils,
} from 'lucide-react';
import type { PetCareField } from '../lib/petForm';

/** The care columns of a pet row; any other pet fields are ignored. */
export type PetCareValues = Partial<Record<PetCareField, string | null>>;

interface CareFieldConfig {
  key: PetCareField;
  label: string;
  icon: typeof Utensils;
  colors: {
    bg: string;
    text: string;
    title: string;
  };
}

const CARE_FIELD_CONFIGS: readonly CareFieldConfig[] = [
  {
    key: 'feeding_instruction',
    label: 'Feeding instructions',
    icon: Utensils,
    colors: { bg: 'bg-amber-50', text: 'text-amber-700', title: 'text-amber-800' },
  },
  {
    key: 'medical_note',
    label: 'Medical notes',
    icon: Pill,
    colors: { bg: 'bg-emerald-50', text: 'text-emerald-700', title: 'text-emerald-800' },
  },
  {
    key: 'behavior_note',
    label: 'Behavior notes',
    icon: Activity,
    colors: { bg: 'bg-purple-50', text: 'text-purple-700', title: 'text-purple-800' },
  },
  {
    key: 'allergies',
    label: 'Allergies',
    icon: AlertCircle,
    colors: { bg: 'bg-red-50', text: 'text-red-700', title: 'text-red-800' },
  },
  {
    key: 'vaccination_info',
    label: 'Vaccination information',
    icon: Syringe,
    colors: { bg: 'bg-blue-50', text: 'text-blue-700', title: 'text-blue-800' },
  },
  {
    key: 'special_requirement',
    label: 'Special requirements',
    icon: ClipboardList,
    colors: { bg: 'bg-teal-50', text: 'text-teal-700', title: 'text-teal-800' },
  },
];

/**
 * Read-only care notes (FR-2.2), showing only the fields that have a value. Renders nothing
 * when every field is blank, so callers need no empty state. Used on the owner's pet card and
 * on the host's view of a booking request.
 */
export function PetCareInfo({ pet, className = '' }: { pet: PetCareValues; className?: string }) {
  const careItems = CARE_FIELD_CONFIGS.flatMap((config) => {
    const value = pet[config.key]?.trim();
    return value ? [{ ...config, value }] : [];
  });

  if (careItems.length === 0) return null;

  return (
    <section className={className} aria-label="Care information">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Care information
      </h3>
      <div className="space-y-2">
        {careItems.map(({ key, label, icon: Icon, colors, value }) => (
          <div key={key} className={`rounded-lg p-3 ${colors.bg}`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${colors.title}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <p className={`mt-1 text-sm whitespace-pre-line break-words ${colors.text}`}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
