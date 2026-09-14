/** Up to 2 uppercase initials from a name, one per word (e.g. "Alex Rivera" -> "AR", "Alex" -> "A"). */
export function getInitials(name?: string | null): string {
  if (!name) {
    return '';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
