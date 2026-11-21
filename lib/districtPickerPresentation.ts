export type DistrictSearchItem = { name: string };

/** Filter district names with the shared Saudi Arabic location normalizer. */
export function filterDistrictsByQuery<T extends DistrictSearchItem>(
  districts: T[],
  query: string,
  normalize: (value: string) => string,
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return districts;
  return districts.filter(district => normalize(district.name).includes(normalizedQuery));
}

/** Avoid displaying a duplicated حي prefix when the source name already includes it. */
export function formatDistrictLabel(name: string): string {
  const trimmed = name.trim();
  return /^حي\\s+/u.test(trimmed) ? trimmed : `حي ${trimmed}`;
}
