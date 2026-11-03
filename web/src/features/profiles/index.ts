export { ProfileScreen } from './components/ProfileScreen';
export { profileKeys, useCurrentProfile, useDeleteAvatar, useUpdateProfile, useUploadAvatar } from './hooks/useProfile';
export { deleteAvatar, getCurrentProfile, getProfile, updateProfile, uploadAvatar } from './lib/profileApi';
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
  SanitizedProfileData,
  ProfileFormValidationResult,
} from './lib/profileValidation';
export type { Profile, ProfileUpdate } from './lib/profileApi';


