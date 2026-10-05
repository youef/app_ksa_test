import {
  Home, ShoppingBag, Store, Package, Wrench, Laptop, GraduationCap, Truck,
} from 'lucide-react-native';

export type ListingTypeId =
  | 'home_family' | 'home_sale' | 'shop' | 'product_in_shop'
  | 'repair' | 'remote' | 'education' | 'delivery';

export type DeliveryModeId = 'delivery' | 'pickup_home' | 'at_shop' | 'home_visit' | 'remote';

export type ExtraField = {
  key: string;
  label: string;
  placeholder?: string;
  kind: 'text' | 'choice';
  options?: string[];
};

export type ListingType = {
  id: ListingTypeId;
  label: string;
  short: string;
  hint: string;
  Icon: any;
  color: string;
  bg: string;
  subcategories: string[];
  defaultModes: DeliveryModeId[];
  extraFields: ExtraField[];
  showShopName?: boolean;
  titlePlaceholder: string;
  /** Visible regardless of the browsing neighborhood */
  nationwide?: boolean;
};

export const LISTING_TYPES: ListingType[] = [
  {
    id: 'home_family', label: 'أسر منتجة', short: 'أسر منتجة', hint: 'أكلات، حلويات، بخور، مشغولات',
    Icon: Home, color: '#be185d', bg: '#fdf2f8',
    subcategories: ['أكلات شعبية', 'حلويات ومعجنات', 'قهوة وتمور', 'بخور وعطور', 'خياطة وتطريز', 'مشغولات يدوية', 'أخرى'],
    defaultModes: ['pickup_home', 'delivery'],
    extraFields: [
      { key: 'preorder', label: 'الطلب المسبق', kind: 'choice', options: ['جاهز فوراً', 'قبل يوم', 'قبل يومين', 'قبل أسبوع'] },
      { key: 'quantity', label: 'الكمية المتاحة', kind: 'text', placeholder: 'مثال: 20 علبة يومياً' },
    ],
    titlePlaceholder: 'مثال: معمول بالتمر بيتي، كبسة على الحطب...',
  },
  {
    id: 'home_sale', label: 'بيع من المنزل', short: 'من البيت', hint: 'ملابس، عطور، مستلزمات',
    Icon: ShoppingBag, color: '#7c3aed', bg: '#f5f3ff',
    subcategories: ['ملابس وعبايات', 'عطور ومكياج', 'إكسسوارات', 'مستلزمات أطفال', 'أدوات منزلية', 'إلكترونيات', 'أخرى'],
    defaultModes: ['pickup_home'],
    extraFields: [
      { key: 'condition', label: 'حالة المنتج', kind: 'choice', options: ['جديد', 'مستعمل نظيف', 'مستعمل'] },
    ],
    titlePlaceholder: 'مثال: عبايات خليجية جديدة، عطور فرنسية...',
  },
  {
    id: 'shop', label: 'محل تجاري', short: 'محلات', hint: 'بقالة، مغسلة، حلاق، مطعم',
    Icon: Store, color: '#0369a1', bg: '#f0f9ff',
    subcategories: ['بقالة وسوبرماركت', 'مطعم وكافيه', 'مغسلة', 'حلاق وصالون', 'صيدلية', 'مخبز', 'أخرى'],
    defaultModes: ['at_shop'],
    extraFields: [
      { key: 'map_link', label: 'رابط الموقع (قوقل ماب)', kind: 'text', placeholder: 'https://maps.google.com/...' },
    ],
    showShopName: true,
    titlePlaceholder: 'مثال: مخبز الحي - خبز طازج يومياً',
  },
  {
    id: 'product_in_shop', label: 'منتجاتي في محل', short: 'في محل', hint: 'منتجك متوفر عند محل معروف',
    Icon: Package, color: '#b45309', bg: '#fffbeb',
    subcategories: ['أغذية', 'حلويات', 'عطور وبخور', 'منتجات عناية', 'أخرى'],
    defaultModes: ['at_shop'],
    extraFields: [
      { key: 'map_link', label: 'رابط موقع المحل', kind: 'text', placeholder: 'https://maps.google.com/...' },
    ],
    showShopName: true,
    titlePlaceholder: 'مثال: صوص حار بيتي متوفر في بقالة...',
  },
  {
    id: 'repair', label: 'صيانة وفنيين', short: 'صيانة', hint: 'جوالات، كمبيوتر، تكييف، كهرباء',
    Icon: Wrench, color: '#c2410c', bg: '#fff7ed',
    subcategories: ['جوالات', 'كمبيوتر ولابتوب', 'تكييف وتبريد', 'كهرباء', 'سباكة', 'أجهزة منزلية', 'سيارات', 'أخرى'],
    defaultModes: ['home_visit', 'at_shop'],
    extraFields: [
      { key: 'warranty', label: 'الضمان', kind: 'choice', options: ['بدون ضمان', 'أسبوع', 'شهر', '3 أشهر', 'سنة'] },
      { key: 'experience', label: 'سنوات الخبرة', kind: 'text', placeholder: 'مثال: 5 سنوات' },
    ],
    titlePlaceholder: 'مثال: صيانة جوالات وتغيير شاشات، فني تكييف...',
  },
  {
    id: 'remote', label: 'خدمات عن بُعد', short: 'عن بُعد', hint: 'تصميم، برمجة، ترجمة، استشارات',
    Icon: Laptop, color: '#4338ca', bg: '#eef2ff',
    subcategories: ['تصميم', 'برمجة ومواقع', 'ترجمة وكتابة', 'تسويق', 'استشارات', 'دعم فني', 'أخرى'],
    defaultModes: ['remote'],
    extraFields: [
      { key: 'delivery_time', label: 'مدة التسليم', kind: 'choice', options: ['نفس اليوم', '1-3 أيام', 'أسبوع', 'حسب المشروع'] },
    ],
    titlePlaceholder: 'مثال: تصميم شعارات وهوية، برمجة مواقع...',
    nationwide: true,
  },
  {
    id: 'education', label: 'تعليم ودروس', short: 'تعليم', hint: 'دروس خصوصية، تحفيظ، تدريب',
    Icon: GraduationCap, color: '#047857', bg: '#ecfdf5',
    subcategories: ['رياضيات وعلوم', 'لغة إنجليزية', 'تحفيظ قرآن', 'قدرات وتحصيلي', 'برمجة للأطفال', 'رياضة وتدريب', 'أخرى'],
    defaultModes: ['home_visit', 'remote'],
    extraFields: [
      { key: 'level', label: 'المرحلة', kind: 'choice', options: ['ابتدائي', 'متوسط', 'ثانوي', 'جامعي', 'الكل'] },
    ],
    titlePlaceholder: 'مثال: معلم رياضيات للمرحلة المتوسطة...',
  },
  {
    id: 'delivery', label: 'توصيل ونقل', short: 'توصيل', hint: 'مشاوير، نقل عفش، طلبات',
    Icon: Truck, color: '#0f766e', bg: '#f0fdfa',
    subcategories: ['توصيل طلبات', 'مشاوير', 'نقل عفش', 'توصيل مدارس', 'أخرى'],
    defaultModes: ['delivery'],
    extraFields: [
      { key: 'range', label: 'النطاق', kind: 'choice', options: ['داخل الحي', 'داخل المدينة', 'بين المدن'] },
    ],
    titlePlaceholder: 'مثال: توصيل مشاوير داخل المدينة...',
  },
];

export const DELIVERY_MODES: { id: DeliveryModeId; label: string; emoji: string }[] = [
  { id: 'delivery', label: 'توصيل', emoji: '🚗' },
  { id: 'pickup_home', label: 'استلام من البيت', emoji: '🏠' },
  { id: 'at_shop', label: 'في المحل', emoji: '🏪' },
  { id: 'home_visit', label: 'زيارة منزلية', emoji: '🧰' },
  { id: 'remote', label: 'عن بُعد', emoji: '🌐' },
];

const LEGACY_CATEGORY_MAP: Record<string, ListingTypeId> = {
  'صيانة منزلية': 'repair',
  'كهرباء وسباكة': 'repair',
  'توصيل ونقل': 'delivery',
  'تعليم ودروس': 'education',
  'تصميم وبرمجة': 'remote',
  'طبخ وضيافة': 'home_family',
};

export function getListingType(id?: string | null, legacyCategory?: string | null): ListingType | null {
  const direct = LISTING_TYPES.find((t) => t.id === id);
  if (direct) return direct;
  const mapped = legacyCategory ? LEGACY_CATEGORY_MAP[legacyCategory] : undefined;
  return mapped ? LISTING_TYPES.find((t) => t.id === mapped) || null : null;
}

export function getDeliveryMode(id: string) {
  return DELIVERY_MODES.find((m) => m.id === id);
}

export function formatServicePrice(item: { price_from?: number | null; price_to?: number | null; price_type?: string | null }) {
  if (item.price_type === 'negotiable' || item.price_from == null) return 'حسب الاتفاق';
  if (item.price_type === 'range' && item.price_to != null) return `${item.price_from} - ${item.price_to} ر.س`;
  return `${item.price_from} ر.س`;
}

export function getServiceCover(item: { cover_url?: string | null; images?: string[] | null }) {
  return item.cover_url || (Array.isArray(item.images) && item.images[0]) || null;
}
