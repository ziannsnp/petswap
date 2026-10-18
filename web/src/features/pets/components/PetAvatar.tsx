import { useState } from 'react';
import { PawPrint } from 'lucide-react';

interface PetAvatarProps {
  /** A displayable URL (signed or blob); without one, or when it fails to load, the paw placeholder shows. */
  src: string | null | undefined;
  alt?: string;
  className: string;
  iconClassName: string;
}

export function PetAvatar({ src, alt = '', className, iconClassName }: PetAvatarProps) {
  // Remembers which URL failed, so a new URL gets its own chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = Boolean(src) && src !== failedSrc;

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand-100 bg-brand-50 ${className}`}>
      {showPhoto && src ? (
        <img className="h-full w-full object-cover" src={src} alt={alt} onError={() => setFailedSrc(src)} />
      ) : (
        <PawPrint className={`${iconClassName} text-brand-600`} aria-hidden="true" />
      )}
    </div>
  );
}
