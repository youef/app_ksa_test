import { OASIS } from '@/lib/oasis';

export type ProfileSectionKey =
  | 'bio'
  | 'services'
  | 'questions'
  | 'products'
  | 'requests'
  | 'reviews'
  | 'achievements';

export const DEFAULT_SECTION_VISIBILITY: Record<ProfileSectionKey, boolean> = {
  bio: true,
  services: true,
  questions: true,
  products: true,
  requests: true,
  reviews: true,
  achievements: true,
};

export const SECTION_META: { key: ProfileSectionKey; label: string; sub: string }[] = [
  { key: 'bio', label: 'النبذة', sub: 'عرض النبذة في الملف العام' },
  { key: 'services', label: 'الخدمات', sub: 'الخدمات المهنية والمهنية' },
  { key: 'questions', label: 'الاستفسارات', sub: 'الأسئلة التي نشرها المستخدم' },
  { key: 'products', label: 'المنتجات', sub: 'المنتجات والسوق' },
  { key: 'requests', label: 'الطلبات', sub: 'طلبات المجتمع' },
  { key: 'reviews', label: 'التقييمات', sub: 'تقييمات الآخرين' },
  { key: 'achievements', label: 'الإنجازات', sub: 'الشارات والإنجازات' },
];

export type ProfileBanner = {
  id: 'emerald' | 'ocean' | 'sunset' | 'midnight';
  label: string;
  colors: [string, string, string];
};

export const PROFILE_BANNERS: ProfileBanner[] = [
  { id: 'emerald', label: 'حيّنا', colors: ['#064E3B', '#047857', '#10B981'] },
  { id: 'ocean', label: 'أزرق', colors: ['#0C4A6E', '#0369A1', '#0EA5E9'] },
  { id: 'sunset', label: 'دافئ', colors: ['#7C2D12', '#C2410C', '#F97316'] },
  { id: 'midnight', label: 'ليلي', colors: ['#0B1120', '#1E293B', '#334155'] },
];

export function bannerColors(style?: string | null): [string, string, string] {
  const found = PROFILE_BANNERS.find((item) => item.id === style);
  return found ? found.colors : PROFILE_BANNERS[0].colors;
}

export type ProfileAccent = { value: string; label: string };

export const PROFILE_ACCENTS: ProfileAccent[] = [
  { value: '#059669', label: 'زمردي' },
  { value: '#0D9488', label: 'فيروزي' },
  { value: '#0284C7', label: 'سماوي' },
  { value: '#2563EB', label: 'أزرق' },
  { value: '#4F46E5', label: 'نيلي' },
  { value: '#7C3AED', label: 'بنفسجي' },
  { value: '#C026D3', label: 'أرجواني' },
  { value: '#DB2777', label: 'وردي' },
  { value: '#E11D48', label: 'أحمر' },
  { value: '#EA580C', label: 'برتقالي' },
  { value: '#CA8A04', label: 'ذهبي' },
  { value: '#475569', label: 'فحمي' },
];

export function normalizeSectionVisibility(value: any): Record<ProfileSectionKey, boolean> {
  const base: Record<ProfileSectionKey, boolean> = { ...DEFAULT_SECTION_VISIBILITY };
  if (value && typeof value === 'object') {
    for (const key of Object.keys(base)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        base[key as ProfileSectionKey] = value[key] !== false;
      }
    }
  }
  return base;
}

export function accentSoft(hex: string, alpha = '1F') {
  return /^#[0-9A-Fa-f]{6}$/.test(String(hex || '')) ? `${hex}${alpha}` : String(hex || OASIS.colors.primary);
}

export const DEFAULT_FEATURED_TITLE = 'أعمالي المميزة';
export const DEFAULT_SECTION_ORDER = ['stats', 'identity', 'featured', 'bio', 'services', 'questions', 'products', 'requests', 'reviews', 'achievements'];
export const DEFAULT_PROFILE_TYPE = 'personal';
export const MAX_FEATURED = 10;
export const DEFAULT_PROFILE_CUSTOMIZATION = {
  accent_color: OASIS.colors.primary,
  banner_style: 'emerald',
  show_stats: true,
  show_badges: true,
  featured_title: DEFAULT_FEATURED_TITLE,
  section_visibility: DEFAULT_SECTION_VISIBILITY,
  section_order: DEFAULT_SECTION_ORDER,
  profile_type: DEFAULT_PROFILE_TYPE,
};
