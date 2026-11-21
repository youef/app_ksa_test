export type CitySearchItem = { name: string };

/** Filter city names using the app's shared Arabic location normalizer. */
export function filterCitiesByQuery<T extends CitySearchItem>(
  cities: T[],
  query: string,
  normalize: (value: string) => string,
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return cities;
  return cities.filter(city => normalize(city.name).includes(normalizedQuery));
}
