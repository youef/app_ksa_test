export const EMPTY_DISTRICTS = new Set(['كل الأحياء', 'كل أحياء المدينة']);

export function isRealDistrict(district?: string | null): boolean {
  return !!district && !EMPTY_DISTRICTS.has(district);
}

export function isRealCity(city?: string | null): boolean {
  return !!city && city !== 'كل المدن';
}

/**
 * يبني نص الموقع بشكل دفاعي، ويتجنب تكرار المدينة إذا كانت داخل المنطقة.
 * مثال: { region: 'منطقة الرياض', city: 'الرياض', district: 'النرجس' }
 *       → "منطقة الرياض · الرياض · حي النرجس"
 */
export function formatLocationParts({
  region,
  city,
  district,
}: {
  region?: string | null;
  city?: string | null;
  district?: string | null;
}): string {
  const parts: string[] = [];
  if (region && region !== city) parts.push(region);
  if (city) parts.push(city);
  if (isRealDistrict(district)) parts.push(`حي ${district}`);
  return parts.join(' · ');
}