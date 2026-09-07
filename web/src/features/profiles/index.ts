export { ProfileScreen } from './components/ProfileScreen';
export { useCurrentProfile } from './hooks/useProfile';
export { getCurrentProfile } from './lib/profileApi';
export {
  DISPLAY_NAME_MAX_LENGTH,
  PHONE_NUMBER_MIN_LENGTH,
  PHONE_NUMBER_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  normalizePhoneNumber,
  validateDisplayName,
  isValidDisplayName,
  validatePhoneNumber,
  isValidPhoneNumber,
  validateLocation,
  isValidLocation,
  validatePhotoUrl,
  isValidPhotoUrl,
  validateProfileForm,
} from './lib/profileValidation';
export type {
  ProfileFormFields,
  ProfileValidationErrors,
} from './lib/profileValidation';
export type { Profile } from './lib/profileApi';

