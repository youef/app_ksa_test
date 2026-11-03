/** Stable, local Saudi city coordinates for weather lookups (approximate city centers).
 * Coordinates are not a user's precise location.
 */
export type SaudiWeatherCity = {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
};

export const SAUDI_WEATHER_REGIONS = [
  'الرياض', 'مكة المكرمة', 'المدينة المنورة', 'المنطقة الشرقية',
  'القصيم', 'عسير', 'تبوك', 'حائل', 'الحدود الشمالية',
  'جازان', 'نجران', 'الباحة', 'الجوف',
] as const;

export const SAUDI_WEATHER_CITIES: SaudiWeatherCity[] = [
  { name: 'الرياض', region: 'الرياض', latitude: 24.7136, longitude: 46.6753 },
  { name: 'الخرج', region: 'الرياض', latitude: 24.1556, longitude: 47.3120 },
  { name: 'الدوادمي', region: 'الرياض', latitude: 24.5077, longitude: 44.3924 },
  { name: 'مكة المكرمة', region: 'مكة المكرمة', latitude: 21.3891, longitude: 39.8579, aliases: ['مكة', 'مكه'] },
  { name: 'جدة', region: 'مكة المكرمة', latitude: 21.5433, longitude: 39.1728, aliases: ['جده'] },
  { name: 'الطائف', region: 'مكة المكرمة', latitude: 21.2703, longitude: 40.4158, aliases: ['طائف'] },
  { name: 'رابغ', region: 'مكة المكرمة', latitude: 22.7986, longitude: 39.0349 },
  { name: 'المدينة المنورة', region: 'المدينة المنورة', latitude: 24.4672, longitude: 39.6111, aliases: ['المدينة', 'مدينه'] },
  { name: 'ينبع', region: 'المدينة المنورة', latitude: 24.0895, longitude: 38.0637 },
  { name: 'العلا', region: 'المدينة المنورة', latitude: 26.6085, longitude: 37.9232 },
  { name: 'الدمام', region: 'المنطقة الشرقية', latitude: 26.4207, longitude: 50.0888 },
  { name: 'الخبر', region: 'المنطقة الشرقية', latitude: 26.2172, longitude: 50.1971 },
  { name: 'الأحساء', region: 'المنطقة الشرقية', latitude: 25.3647, longitude: 49.5890, aliases: ['الهفوف'] },
  { name: 'الجبيل', region: 'المنطقة الشرقية', latitude: 27.0046, longitude: 49.6460 },
  { name: 'حفر الباطن', region: 'المنطقة الشرقية', latitude: 28.4328, longitude: 45.9708 },
  { name: 'بريدة', region: 'القصيم', latitude: 26.3592, longitude: 43.9818, aliases: ['بريده'] },
  { name: 'عنيزة', region: 'القصيم', latitude: 26.0889, longitude: 43.9786 },
  { name: 'الرس', region: 'القصيم', latitude: 25.8694, longitude: 43.4973 },
  { name: 'أبها', region: 'عسير', latitude: 18.2164, longitude: 42.5053, aliases: ['ابها'] },
  { name: 'خميس مشيط', region: 'عسير', latitude: 18.3064, longitude: 42.7292 },
  { name: 'بيشة', region: 'عسير', latitude: 20.0000, longitude: 42.6050 },
  { name: 'تبوك', region: 'تبوك', latitude: 28.3835, longitude: 36.5662 },
  { name: 'ضباء', region: 'تبوك', latitude: 27.3499, longitude: 35.6915 },
  { name: 'حائل', region: 'حائل', latitude: 27.5114, longitude: 41.7208 },
  { name: 'عرعر', region: 'الحدود الشمالية', latitude: 30.9753, longitude: 41.0381 },
  { name: 'رفحاء', region: 'الحدود الشمالية', latitude: 29.6370, longitude: 43.4919 },
  { name: 'طريف', region: 'الحدود الشمالية', latitude: 31.6725, longitude: 38.6638 },
  { name: 'جازان', region: 'جازان', latitude: 16.8892, longitude: 42.5511, aliases: ['جيزان'] },
  { name: 'صبيا', region: 'جازان', latitude: 17.1484, longitude: 42.6256 },
  { name: 'نجران', region: 'نجران', latitude: 17.5650, longitude: 44.2289 },
  { name: 'الباحة', region: 'الباحة', latitude: 20.0129, longitude: 41.4677 },
  { name: 'بلجرشي', region: 'الباحة', latitude: 19.8700, longitude: 41.5660 },
  { name: 'سكاكا', region: 'الجوف', latitude: 29.9697, longitude: 40.2064 },
  { name: 'القريات', region: 'الجوف', latitude: 31.3318, longitude: 37.3428 },
];

function normaliseSaudiPlace(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
}

export function findSaudiWeatherCity(name: string): SaudiWeatherCity | undefined {
  const key = normaliseSaudiPlace(name);
  if (!key) return undefined;
  return SAUDI_WEATHER_CITIES.find(city =>
    [city.name, ...(city.aliases || [])].some(item => normaliseSaudiPlace(item) === key)
  );
}

export function saudiWeatherTimeKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '00';
  return part('year') + '-' + part('month') + '-' + part('day') + 'T' + part('hour') + ':' + part('minute');
}

export function formatSaudiWeatherTime(value?: string | null): string {
  if (!value) return '--';
  const zoned = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + '+03:00';
  const date = new Date(zoned);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
}
