export function toPlayerDisplayName(value: string | null | undefined): string {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!normalized) {
    return '';
  }

  const parts = normalized.split(' ');
  if (parts.length <= 1) {
    return normalized;
  }

  return `${parts[0]} ${parts[parts.length - 1]}`;
}
