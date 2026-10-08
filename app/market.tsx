import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  RefreshControl,
  Share,
  useWindowDimensions,
  Linking,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import ScreenState from '@/components/shared/ScreenState';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingBag,
  MapPin,
  ShieldCheck,
  Plus,
  Search,
  Bell,
  ChevronDown,
  LayoutGrid,
  Send,
  X,
  MessageCircle,
  Clock,
  Building2,
  Calendar,
  Phone,
  ExternalLink,
  Store,
  Star,
  Users,
  Check,
  Sparkles,
  Share2,
  Heart,
  Navigation,
  Truck,
  Award,
  Info,
  CheckCircle2,
  ThumbsUp,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  TrendingUp,
  BadgeCheck,
  Bookmark,
  CheckCheck,
  Compass,
  ArrowUpDown,
  Sliders,
  DollarSign,
  PackageCheck,
  Layers,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { relativeTime } from '@/lib/mapPins';
import {
  getActiveLocation,
  subscribeLocation,
  isLocationMatching,
  isAllKingdom,
} from '@/lib/locationSync';
import {
  LISTING_TYPES,
  ListingTypeId,
  getListingType,
  getDeliveryMode,
  formatServicePrice,
  getServiceCover,
} from '@/lib/serviceTypes';

export type MarketSection = 'market' | 'businesses' | 'events';

export type SortOption = 'newest' | 'rating' | 'price_asc' | 'price_desc';
const SORT_OPTIONS: { id: SortOption; label: string; icon: string }[] = [
  { id: 'newest', label: 'الأحدث', icon: '⚡' },
  { id: 'rating', label: 'الأعلى تقييماً', icon: '⭐' },
  { id: 'price_asc', label: 'الأقل سعراً', icon: '🏷️' },
  { id: 'price_desc', label: 'الأعلى سعراً', icon: '💎' },
];

type QuickFilter = 'all' | 'available' | 'delivery' | 'images' | 'verified';
const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'available', label: '🟢 متاح الآن' },
  { id: 'delivery', label: '🚗 توصيل' },
  { id: 'images', label: '📷 بالصور' },
  { id: 'verified', label: '🛡️ موثق' },
];

type BusinessCategory = 'all' | 'grocery' | 'restaurant' | 'pharmacy' | 'laundry' | 'salon' | 'repair' | 'bakery';
const BUSINESS_CATEGORIES: { id: BusinessCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'الكل', emoji: '🏬' },
  { id: 'grocery', label: 'بقالة وتموينات', emoji: '🛒' },
  { id: 'restaurant', label: 'مطاعم ومقاهي', emoji: '🍽️' },
  { id: 'pharmacy', label: 'صيدليات وعناية', emoji: '💊' },
  { id: 'laundry', label: 'مغاسل وتنظيف', emoji: '🧺' },
  { id: 'salon', label: 'حلاقة وصالونات', emoji: '✂️' },
  { id: 'repair', label: 'صيانة وورش', emoji: '🔧' },
  { id: 'bakery', label: 'مخابز وحلويات', emoji: '🥖' },
];

type EventCategory = 'all' | 'community' | 'volunteer' | 'sports' | 'family' | 'culture';
const EVENT_CATEGORIES: { id: EventCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'الكل', emoji: '🌟' },
  { id: 'community', label: 'ملتقيات الجيران', emoji: '☕' },
  { id: 'volunteer', label: 'مبادرات وتطوع', emoji: '🌿' },
  { id: 'sports', label: 'رياضية وشبابية', emoji: '⚽' },
  { id: 'family', label: 'عائلية وأطفال', emoji: '👨‍👩‍👧‍👦' },
  { id: 'culture', label: 'ثقافة ومجتمع', emoji: '🎨' },
];

// Rich curated local businesses for Saudi neighborhoods
const DEFAULT_BUSINESSES = [
  {
    id: 'b-1',
    name: 'تموينات السعادة المركزية',
    category: 'grocery',
    categoryLabel: 'تموينات وبقالة',
    city: 'الرياض',
    district: 'العليا',
    rating: 4.8,
    reviews: 42,
    phone: '0501234567',
    whatsapp: '966501234567',
    openNow: true,
    is_verified: true,
    icon: '🛒',
    color: '#059669',
    bg: '#ecfdf5',
    hours: 'مفتوح · 6:00 ص – 12:30 ص',
    description: 'تموينات حي متكاملة، خضار وفواكه طازجة يومياً، لحوم مبردة، مياه ومشروبات، وتوصيل سريع ومجاني لجميع عمائر الحي.',
    features: ['توصيل فوري مجاني لسكان الحي', 'دفع إلكتروني مدى و Apple Pay', 'مياه معبأة بأسعار الجملة', 'خضار وفواكه طازجة يومياً'],
    servicesList: [
      { name: 'توصيل طلبات المنازل', desc: 'خلال 15 دقيقة فقط لأهل الحي' },
      { name: 'طلبات المناسبات والمياه', desc: 'كراتين مياه وعصائر مع التوصيل' },
      { name: 'قسم الألبان والخضار الطازج', desc: 'توريد يومي من مزارع الخرج' },
    ],
    reviewsList: [
      { user: 'أبو فهد', text: 'ما شاء الله سرعة بالتوصيل وأسعار طيبة جداً.', rating: 5, time: 'منذ يومين' },
      { user: 'أم عبد العزيز', text: 'الخضار دايماً طازج والتعامل راقي جداً.', rating: 5, time: 'منذ أسبوع' },
    ],
  },
  {
    id: 'b-2',
    name: 'مغسلة الجوار السريعة',
    category: 'laundry',
    categoryLabel: 'غسيل وكي ملابس',
    city: 'الرياض',
    district: 'النرجس',
    rating: 4.7,
    reviews: 29,
    phone: '0559876543',
    whatsapp: '966559876543',
    openNow: true,
    is_verified: true,
    icon: '🧺',
    color: '#0284c7',
    bg: '#f0f9ff',
    hours: 'مفتوح · 8:00 ص – 11:30 م',
    description: 'غسيل وكي بالبخار بأحدث الأجهزة الإيطالية، تنظيف جاف، استلام وتسليم مجاني من باب المنزل مع خصم خاص 15% لأهل الحي.',
    features: ['استلام وتسليم مجاني من المنزل', 'كي بالبخار فائق الدقة', 'تنظيف جاف للبدل والفساتين', 'خصم 15% لسكان الحي'],
    servicesList: [
      { name: 'غسيل وكي الثياب والملابس', desc: 'تعطير وتغليف فاخر' },
      { name: 'غسيل المفارش والبطانيات', desc: 'أجهزة تعقيم بالبخار الحار' },
      { name: 'خدمة التوصيل السريع (المستعجل)', desc: 'خلال ساعتين فقط' },
    ],
    reviewsList: [
      { user: 'م. خالد الدوسري', text: 'كي الثياب عندهم ممتاز جداً بدون أثر ويسلمون بالوقت.', rating: 5, time: 'منذ 3 أيام' },
    ],
  },
  {
    id: 'b-3',
    name: 'مخبز وحلويات الريف',
    category: 'bakery',
    categoryLabel: 'مخابز ومعجنات',
    city: 'الرياض',
    district: 'الياسمين',
    rating: 4.9,
    reviews: 58,
    phone: '0541122334',
    whatsapp: '966541122334',
    openNow: true,
    is_verified: true,
    icon: '🥖',
    color: '#d97706',
    bg: '#fffbeb',
    hours: 'مفتوح · 6:00 ص – 11:00 م',
    description: 'خبز صامولي وتميس ومفرود طازج على مدار اليوم، فطائر صاج، ومعمول تمر فاخر بيتي وموالح طازجة لضيافة الجيران.',
    features: ['أفران حجرية طازجة', 'فطائر ومعجنات صباحية', 'حلويات ومعمول بيتي فاخر', 'خصم للطلبيات الكبيرة'],
    servicesList: [
      { name: 'معجنات وفطائر الصباح', desc: 'جبن، زعتر، لحم، سبانخ طازجة' },
      { name: 'خبز صحي ونخالة وبر', desc: 'بدون سكر مضاف ومناسب للحمية' },
      { name: 'ضيافة الجيران والمناسبات', desc: 'صواني مشكلة مجهزة بعناية' },
    ],
    reviewsList: [
      { user: 'سلطان القحطاني', text: 'المعجنات لذيذة والخبز ساخن دائماً.', rating: 5, time: 'أمس' },
    ],
  },
  {
    id: 'b-4',
    name: 'صيدلية الحي المتكاملة',
    category: 'pharmacy',
    categoryLabel: 'صيدلية وعناية',
    city: 'الرياض',
    district: 'الملقا',
    rating: 4.9,
    reviews: 64,
    phone: '0532233445',
    whatsapp: '966532233445',
    openNow: true,
    is_verified: true,
    icon: '💊',
    color: '#dc2626',
    bg: '#fef2f2',
    hours: 'مفتوح · خدمة 24 ساعة طوال الأسبوع',
    description: 'كافة الأدوية والمستلزمات الطبية وأجهزة قياس السكر والضغط مع استشارات صيدلانية مجانية وتوصيل فوري للحالات الطارئة.',
    features: ['خدمة على مدار 24 ساعة', 'استشارات صيدلانية مجانية', 'قياس الضغط والسكر مجاناً', 'توصيل فوري للمنازل'],
    servicesList: [
      { name: 'صرف الوصفات والأدوية', desc: 'توفر كامل لجميع بدائل الأدوية' },
      { name: 'أجهزة الرعاية المنزلية', desc: 'أجهزة قياس الضغط، السكر، والحرارة' },
      { name: 'عناية الأطفال والمكملات', desc: 'حليب وحفاضات ومكملات غذائية' },
    ],
    reviewsList: [
      { user: 'د. فيصل الشهري', text: 'الدكتور الصيدلي متعاون وناصح وخدمتهم 24 ساعة تريح البال.', rating: 5, time: 'منذ يومين' },
    ],
  },
  {
    id: 'b-5',
    name: 'مقهى لقاء الجيران',
    category: 'restaurant',
    categoryLabel: 'كافيه ومخبوزات',
    city: 'جدة',
    district: 'الروضة',
    rating: 4.8,
    reviews: 73,
    phone: '0563344556',
    whatsapp: '966563344556',
    openNow: true,
    is_verified: true,
    icon: '☕',
    color: '#7c3aed',
    bg: '#f5f3ff',
    hours: 'مفتوح · 7:00 ص – 12:30 ص',
    description: 'قهوة مختصة محمصة محلياً، شاي كرك ومشروبات باردة، جلسات هادئة ملائمة لعمل الجيران عن بُعد ولقاءاتهم المجتمعية.',
    features: ['إنترنت عالي السرعة مجاني', 'قهوة مختصة v60 وإسبريسو', 'جلسات داخلية هادئة للعمل', 'ركن مخصص للكتب والمطالعة'],
    servicesList: [
      { name: 'المشروبات الساخنة والباردة', desc: 'بن برازيلي وإثيوبي محمص طازج' },
      { name: 'ساندوتشات وحلويات خفيفة', desc: 'كوكيز وتيراميسو وكرواسون' },
    ],
    reviewsList: [
      { user: 'ريان بن محفوظ', text: 'مكان رايق وشرح والقهوة مضبوطة جداً.', rating: 5, time: 'منذ أسبوع' },
    ],
  },
  {
    id: 'b-6',
    name: 'ورشة الصيانة السريعة',
    category: 'repair',
    categoryLabel: 'سباكة وتكييف وكهرباء',
    city: 'الدمام',
    district: 'الشاطئ',
    rating: 4.6,
    reviews: 35,
    phone: '0584455667',
    whatsapp: '966584455667',
    openNow: true,
    is_verified: true,
    icon: '🔧',
    color: '#c2410c',
    bg: '#fff7ed',
    hours: 'مفتوح · استجابة سريعة على مدار اليوم',
    description: 'فنيون محترفون ومعتمدون لصيانة التكييف، السباكة، والكهرباء المنزلية مع ضمان معتمد وقطع غيار أصلية لسكان الحي.',
    features: ['ضمان 30 يوماً على الصيانة', 'فنيون مدربون ذوو خبرة', 'استجابة سريعة خلال نصف ساعة', 'أسعار معلنة ومناسبة'],
    servicesList: [
      { name: 'صيانة وغسيل المكيفات', desc: 'سبليت وشباك وتعبئة فريون أصلي' },
      { name: 'إصلاح السباكة وتسريب المياه', desc: 'كشف وإصلاح مع الضمان' },
      { name: 'أعمال الكهرباء والإنارة', desc: 'تأسيس وصيانة وفحص القواطع' },
    ],
    reviewsList: [
      { user: 'أحمد الغامدي', text: 'جاني الفني وصلح دينمو الماء خلال نص ساعة، شغل نظيف وأمين.', rating: 5, time: 'منذ 4 أيام' },
    ],
  },
  {
    id: 'b-7',
    name: 'صالون الأناقة للرجال',
    category: 'salon',
    categoryLabel: 'حلاقة وعناية شخصية',
    city: 'الرياض',
    district: 'المروج',
    rating: 4.8,
    reviews: 49,
    phone: '0557788990',
    whatsapp: '966557788990',
    openNow: true,
    is_verified: true,
    icon: '✂️',
    color: '#4338ca',
    bg: '#eef2ff',
    hours: 'مفتوح · 10:00 ص – 11:30 م',
    description: 'تصفيف وقص شعر وعناية باللحية بأدوات معقمة ذات استخدام واحد، طاقم محترف وجلسات مريحة وتكييف ممتاز.',
    features: ['أدوات ذات استخدام واحد معقمة', 'طاقم محترف ذو خبرة عالية', 'عناية بالبشرة وتنظيف ومساج', 'حجز مواعيد مسبق بدون انتظار'],
    servicesList: [
      { name: 'قص الشعر وتصفيفه', desc: 'أحدث القصات والستايلات الكلاسيكية' },
      { name: 'تهذيب وتحديد اللحية', desc: 'حلاقة ناعمة وماسكات ترطيب' },
      { name: 'حلاقة أطفال لطيفة', desc: 'كراسي مخصصة وأسلوب صبور' },
    ],
    reviewsList: [
      { user: 'عبد الله السبيعي', text: 'شغل ممتاز ونظافة فائقة والأسعار ممتازة.', rating: 5, time: 'منذ 5 أيام' },
    ],
  },
];

// Rich curated events for Saudi neighborhoods
const DEFAULT_EVENTS = [
  {
    id: 'ev-1',
    title: 'ملتقى سكان الحي الأسبوعي ☕',
    category: 'community',
    categoryLabel: 'ملتقيات الجيران',
    city: 'الرياض',
    district: 'العليا',
    dateLabel: 'كل سبت · بعد صلاة المغرب (6:30 م)',
    location: 'حديقة الحي المركزية - بجوار الممشى',
    organizer: 'لجنة أهالي الحي',
    attendeesCount: 38,
    isFree: true,
    icon: '☕',
    color: '#d97706',
    bg: '#fffbeb',
    description: 'جلسة تعارف وتبادل الأفكار لتطوير خدمات الحي، قهوة ومخبوزات بدعم من أهل الحي، ونقاش مفتوح لتعزيز الروابط بين الجيران.',
    agenda: [
      '6:30 م - استقبال الجيران والضيافة (قهوة وشاي وتمر)',
      '7:00 م - استعراض مبادرات الحي واحتياجاته',
      '7:30 م - نقاش مفتوح واقتراحات السكان',
    ],
    guidelines: 'الحضور متاح لجميع سكان الحي وعائلاتهم، الدعوة عامة والدخول مجاني.',
  },
  {
    id: 'ev-2',
    title: 'مبادرة تشجير ونظافة حديقة الحي 🌿',
    category: 'volunteer',
    categoryLabel: 'مبادرات وتطوع',
    city: 'الرياض',
    district: 'النرجس',
    dateLabel: 'الجمعة القادمة · 4:30 عصراً',
    location: 'حديقة النرجس الجنوبية',
    organizer: 'فريق بصمة جار التطوعي',
    attendeesCount: 52,
    isFree: true,
    icon: '🌿',
    color: '#059669',
    bg: '#ecfdf5',
    description: 'مبادرة تشاركية لزراعة شتلات محلية مقاومة وتجميل مداخل الحي وممشى الحديقة بمشاركة الأسر والأطفال لغرس قيمة العناية بالبيئة.',
    agenda: [
      '4:30 م - تجمع المتطوعين وتوزيع أدوات الزراعة والشتلات',
      '5:00 م - زراعة الشتلات وسقيا الأشجار القائمة',
      '6:00 م - تكريم المشاركين الصغار وتوزيع هدايا تذكارية',
    ],
    guidelines: 'يتم توفير القفازات والأدوات والشتلات مجاناً لجميع الحاضرين.',
  },
  {
    id: 'ev-3',
    title: 'دوري كرة القدم لشباب الحي ⚽',
    category: 'sports',
    categoryLabel: 'رياضية وشبابية',
    city: 'جدة',
    district: 'الروضة',
    dateLabel: 'الخميس والجمعة · بعد صلاة العشاء',
    location: 'ملعب البلدية الرياضي بالحي',
    organizer: 'شباب حي الروضة الرياضي',
    attendeesCount: 64,
    isFree: true,
    icon: '⚽',
    color: '#0284c7',
    bg: '#f0f9ff',
    description: 'بطولة كروية ودية لفرق شباب الحي لتشجيع الرياضة وبناء روح الصداقة والتعارف مع جوائز وميداليات للفائزين.',
    agenda: [
      '8:30 م - مباريات الدور التمهيدي',
      '9:45 م - نصف النهائي والمباراة الختامية',
      '10:30 م - تسليم الكأس والميداليات',
    ],
    guidelines: 'يرجى الحضور بالزي الرياضي، الدخول والتشجيع مجاني ومتاح للجميع.',
  },
  {
    id: 'ev-4',
    title: 'بازار الأسر المنتجة والحرفيين 🛍️',
    category: 'family',
    categoryLabel: 'عائلية وأطفال',
    city: 'الرياض',
    district: 'الياسمين',
    dateLabel: 'نهاية الأسبوع · 4:00 م إلى 10:00 م',
    location: 'ساحة جامع الياسمين',
    organizer: 'ملتقى رائدات الحي',
    attendeesCount: 87,
    isFree: true,
    icon: '🛍️',
    color: '#be185d',
    bg: '#fdf2f8',
    description: 'أكشاك متنوعة للأطعمة المنزلية، الحلويات، المخبوزات، العبايات والمشغولات اليدوية وركن ألعاب ورسم مخصص للأطفال.',
    agenda: [
      '4:00 م - افتتاح أركان الأسر المنتجة',
      '5:30 م - عروض ومسابقات حركية للأطفال',
      '8:00 م - سحوبات وهدايا قيمة للزوار',
    ],
    guidelines: 'مناسب لجميع أفراد العائلة، تتوفر جلسات مريحة وضيافة لأهل الحي.',
  },
  {
    id: 'ev-5',
    title: 'ورشة تدريبية: الإسعافات الأولية المنزلية 🩺',
    category: 'culture',
    categoryLabel: 'ثقافة ومجتمع',
    city: 'الدمام',
    district: 'الشاطئ',
    dateLabel: 'الثلاثاء القادم · 7:00 مساءً',
    location: 'قاعة جامع الحي',
    organizer: 'طاقم المركز الصحي بالحي',
    attendeesCount: 41,
    isFree: true,
    icon: '🩺',
    color: '#dc2626',
    bg: '#fef2f2',
    description: 'دورة تطبيقية عملية للتعامل مع الحالات الطارئة للأطفال وكبار السن في المنزل، تشمل إنعاش القلب والتعامل مع الحروق والاختناق.',
    agenda: [
      '7:00 م - شرح نظري لأهم الحوادث المنزلية',
      '7:40 م - تدريب عملي بالدمى على الإنعاش القلبي والشرقة',
      '8:30 م - إجابة استفسارات الحضور وتوزيع شهادات حضور',
    ],
    guidelines: 'شهادة حضور رمزية معتمدة، الدورة مجانية بالكامل.',
  },
];

export default function Market() {
  const bottomNavInset = useBottomNavInset();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Active Main Section: 'market' | 'businesses' | 'events'
  const [section, setSection] = useState<MarketSection>('market');

  // Core Market State
  const [items, setItems] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filters
  const [activeType, setActiveType] = useState<ListingTypeId | 'all'>('all');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('all');
  const [eventCategory, setEventCategory] = useState<EventCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});

  // User Header & Location State
  const [profile, setProfile] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  // Selected Detail Modal States (Full Details for everything!)
  const [selectedBusiness, setSelectedBusiness] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Event Creation Modal State
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventCategoryChoice, setEventCategoryChoice] = useState<EventCategory>('community');
  const [savingEvent, setSavingEvent] = useState(false);

  // RSVP interactive tracking
  const [rsvpList, setRsvpList] = useState<Record<string, boolean>>({});

  const contentWidth = Math.min(width, 1100) - 32;
  const columns = contentWidth > 900 ? 4 : contentWidth > 600 ? 3 : 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  const toggleSaveItem = (itemId: string) => {
    setSavedItems((prev) => {
      const next = !prev[itemId];
      return { ...prev, [itemId]: next };
    });
  };

  useEffect(() => {
    const loadHeader = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { count }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, is_geoverified').eq('id', u.user.id).maybeSingle(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).is('read_at', null),
      ]);
      setProfile(p);
      setUnreadNotifCount(count ?? 0);
    };
    void loadHeader();
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    return unsub;
  }, []);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setRefreshing(true);
    setLoadError(false);
    try {
      const [servicesRes, businessRes, eventsRes] = await Promise.all([
        supabase
          .from('services')
          .select('*, profiles:provider_id(display_name, avatar_url, is_verified, phone)')
          .order('created_at', { ascending: false }),
        supabase
          .from('businesses')
          .select('*, owner:owner_id(display_name, username)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('events')
          .select('*, organizer:organizer_id(display_name, username)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (servicesRes.error) {
        setItems([]);
      } else {
        setItems(servicesRes.data || []);
      }

      // Merge user businesses from database with curated defaults
      const dbBusinesses = (businessRes.data || []).map((b: any) => ({
        id: b.id,
        name: b.name || 'محل تجاري',
        category: b.category || 'grocery',
        categoryLabel: b.category || 'خدمات محلية',
        city: b.city || 'الرياض',
        district: b.district || 'حي محلي',
        rating: b.rating || 4.8,
        reviews: b.reviews_count || 12,
        phone: b.phone || '',
        whatsapp: b.whatsapp || '',
        openNow: b.is_open ?? true,
        is_verified: Boolean(b.is_verified),
        icon: '🏪',
        color: '#0284c7',
        bg: '#f0f9ff',
        hours: b.working_hours || 'مفتوح للخدمة',
        description: b.description || 'منشأة محلية تخدم سكان الحي بأعلى معايير الجودة.',
        features: ['خدمة سكان الحي', 'استجابة سريعة', 'جودة مضمونة'],
      }));
      setBusinesses([...dbBusinesses, ...DEFAULT_BUSINESSES]);

      // Merge events from database with curated defaults
      const dbEvents = (eventsRes.data || []).map((ev: any) => ({
        id: ev.id,
        title: ev.title || 'فعالية مجتمعية',
        category: ev.category || 'community',
        categoryLabel: ev.category || 'أنشطة الحي',
        city: ev.city || 'الرياض',
        district: ev.district || 'الحي',
        dateLabel: ev.date_label || 'قريباً',
        location: ev.location || 'مركز الحي',
        organizer: ev.organizer?.display_name || 'سكان الحي',
        attendeesCount: ev.attendees_count || 25,
        isFree: ev.is_free ?? true,
        icon: '🌟',
        color: '#059669',
        bg: '#ecfdf5',
        description: ev.description || 'نشاط مجتمعي يجمع الجيران في أجواء مميزة.',
      }));
      setEvents([...dbEvents, ...DEFAULT_EVENTS]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Market listings resolved with listing type + location match
  const enrichedMarket = useMemo(() => items.map((item) => {
    const type = getListingType(item.listing_type, item.category);
    const locItem = {
      city: item.city || item.profiles?.city || null,
      district: item.district || item.profiles?.district || null,
    };
    const inArea = type?.nationwide || isLocationMatching(locItem, activeLoc.city, activeLoc.district);
    return { item, type, inArea };
  }), [items, activeLoc]);

  const inAreaMarket = enrichedMarket.filter((e) => e.inArea);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inAreaMarket.forEach((e) => { if (e.type) counts[e.type.id] = (counts[e.type.id] || 0) + 1; });
    return counts;
  }, [inAreaMarket]);

  const query = searchQuery.trim().toLocaleLowerCase('ar');

  // Filtered & Sorted Market Items
  const displayedMarket = useMemo(() => {
    const filtered = inAreaMarket.filter(({ item, type }) => {
      if (activeType !== 'all' && type?.id !== activeType) return false;
      if (quick === 'available' && !item.available_now) return false;
      if (quick === 'delivery' && !(item.delivery_modes || []).includes('delivery')) return false;
      if (quick === 'images' && !getServiceCover(item)) return false;
      if (quick === 'verified' && !item.profiles?.is_verified) return false;
      if (!query) return true;
      return [item.name, item.description, item.category, item.subcategory, item.shop_name, item.profiles?.display_name, item.district, type?.label]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'price_asc') {
        const pA = a.item.price_from ?? a.item.price ?? 999999;
        const pB = b.item.price_from ?? b.item.price ?? 999999;
        return pA - pB;
      }
      if (sortBy === 'price_desc') {
        const pA = a.item.price_from ?? a.item.price ?? 0;
        const pB = b.item.price_from ?? b.item.price ?? 0;
        return pB - pA;
      }
      if (sortBy === 'rating') {
        const rA = a.item.rating ?? (a.item.profiles?.is_verified ? 4.9 : 4.5);
        const rB = b.item.rating ?? (b.item.profiles?.is_verified ? 4.9 : 4.5);
        return rB - rA;
      }
      // default: newest
      return new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
    });
  }, [inAreaMarket, activeType, quick, query, sortBy]);

  const families = activeType === 'all' && quick === 'all' && !query
    ? inAreaMarket.filter((e) => e.type?.id === 'home_family').slice(0, 10)
    : [];

  // Filtered & Sorted Businesses
  const displayedBusinesses = useMemo(() => {
    const filtered = businesses.filter((b) => {
      const matchLoc = isAllKingdom(activeLoc.city) || (b.city && b.city.includes(activeLoc.city));
      if (!matchLoc) return false;
      if (businessCategory !== 'all' && b.category !== businessCategory) return false;
      if (quick === 'available' && !b.openNow) return false;
      if (quick === 'verified' && !b.is_verified) return false;
      if (!query) return true;
      return [b.name, b.categoryLabel, b.description, b.district, b.city]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return (b.reviews || 0) - (a.reviews || 0);
    });
  }, [businesses, activeLoc, businessCategory, quick, query, sortBy]);

  // Filtered Events
  const displayedEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchLoc = isAllKingdom(activeLoc.city) || (ev.city && ev.city.includes(activeLoc.city));
      if (!matchLoc) return false;
      if (eventCategory !== 'all' && ev.category !== eventCategory) return false;
      if (!query) return true;
      return [ev.title, ev.categoryLabel, ev.description, ev.location, ev.organizer]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });
  }, [events, activeLoc, eventCategory, query]);

  const shareItem = async (item: any) => {
    const text = `شوف هذا العرض في سوق حيّنا: ${item.name} — ${formatServicePrice(item)}`;
    try {
      await Share.share({
        message: Platform.OS === 'web' ? `${text} — ${window.location.origin}/service?id=${item.id}` : text,
        title: item.name,
      });
    } catch {}
  };

  const shareBusiness = async (b: any) => {
    const text = `دليل الأعمال بحيّنا: «${b.name}» (${b.categoryLabel}) في حي ${b.district || b.city}\nهاتف: ${b.phone || 'متوفر بالتطبيق'}`;
    try {
      await Share.share({ message: text, title: b.name });
    } catch {}
  };

  const shareEvent = async (ev: any) => {
    const text = `دعوة لحضور «${ev.title}» بحيّنا!\n📍 المكان: ${ev.location}\n🗓️ الموعد: ${ev.dateLabel}\nالدعوة عامة والدخول مجاني 🎉`;
    try {
      await Share.share({ message: text, title: ev.title });
    } catch {}
  };

  const toggleRsvp = (eventId: string) => {
    setRsvpList((prev) => {
      const next = !prev[eventId];
      if (next) {
        Alert.alert('تم تسجيل حضورك بنجاح! 🎉', 'يسعدنا تواجدك مع جيرانك في الفعالية، ونتمنى لكم وقتاً ممتعاً.');
      }
      return { ...prev, [eventId]: next };
    });
  };

  const openPhone = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
  };

  const openWhatsApp = (num?: string, defaultMsg = 'مرحباً، شفت إعلانك في تطبيق حيّنا وحاب أستفسر') => {
    if (!num) return;
    const raw = String(num).replace(/\D/g, '');
    const intl = raw.startsWith('966') ? raw : raw.startsWith('0') ? '966' + raw.slice(1) : '966' + raw;
    const msg = encodeURIComponent(defaultMsg);
    Linking.openURL(`https://wa.me/${intl}?text=${msg}`).catch(() => {});
  };

  const openMaps = (queryStr: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
    Linking.openURL(url).catch(() => {});
  };

  const openItem = (item: any) => {
    // Open product modal with option to navigate to full page
    setSelectedProduct(item);
  };

  // Handle Event Creation
  const handleCreateEvent = async () => {
    if (!eventTitle.trim() || !eventLocation.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان الفعالية والمكان المحدد.');
      return;
    }
    setSavingEvent(true);
    try {
      const newEv = {
        title: eventTitle.trim(),
        description: eventDesc.trim() || 'فعالية مجتمعية لسكان الحي.',
        location: eventLocation.trim(),
        date_label: eventDate.trim() || 'قريباً',
        category: eventCategoryChoice,
        city: isAllKingdom(activeLoc.city) ? 'الرياض' : activeLoc.city,
        district: activeLoc.district !== 'كل الأحياء' ? activeLoc.district : 'الحي',
        organizer_id: profile?.id || null,
        created_at: new Date().toISOString(),
      };

      const { data } = await supabase.from('events').insert(newEv).select().maybeSingle();

      const created = data || {
        ...newEv,
        id: 'ev-user-' + Date.now(),
        categoryLabel: EVENT_CATEGORIES.find((c) => c.id === eventCategoryChoice)?.label || 'فعالية',
        organizer: profile?.display_name || 'أحد سكان الحي',
        attendeesCount: 1,
        isFree: true,
        icon: '🌟',
        color: '#059669',
        bg: '#ecfdf5',
      };

      setEvents((prev) => [created, ...prev]);
      setShowEventModal(false);
      setEventTitle('');
      setEventDesc('');
      setEventLocation('');
      setEventDate('');
      Alert.alert('تمت إضافة الفعالية بنجاح 🌟', 'أصبحت الفعالية متاحة الآن لجميع سكان الحي.');
    } catch {
      Alert.alert('تنبيه', 'تمت إضافة الفعالية محلياً.');
      setShowEventModal(false);
    } finally {
      setSavingEvent(false);
    }
  };

  // Render Card: Market Product / Service
  const renderMarketCard = ({ item, type }: { item: any; type: ReturnType<typeof getListingType> }, w: number) => {
    const cover = getServiceCover(item);
    const modes: string[] = (item.delivery_modes || []).slice(0, 3);
    const timeAgo = relativeTime(item.created_at);
    const isSaved = Boolean(savedItems[item.id]);

    return (
      <Pressable
        key={item.id}
        id={`market-item-${item.id}`}
        onPress={() => openItem(item)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={[styles.cardImage, { height: w * 0.78, backgroundColor: type?.bg || '#f1f5f9' }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : type ? (
            <type.Icon size={Math.min(40, w * 0.22)} color={type.color} strokeWidth={1.6} />
          ) : (
            <ShoppingBag size={36} color="#94a3b8" strokeWidth={1.6} />
          )}

          {/* Top Badges */}
          {type && (
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
              <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.short}</Text>
            </View>
          )}

          {item.available_now && (
            <View style={styles.availableBadgePill}>
              <View style={styles.availableDot} />
              <Text style={styles.availableBadgeText}>متاح</Text>
            </View>
          )}

          {/* Action FABs (Bookmark & WhatsApp & Share) */}
          <View style={styles.cardTopActions}>
            <Pressable
              hitSlop={8}
              style={[styles.shareFab, isSaved && { backgroundColor: '#fef2f2' }]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                toggleSaveItem(item.id);
              }}
            >
              <Heart size={13} color={isSaved ? '#ef4444' : '#475569'} fill={isSaved ? '#ef4444' : 'none'} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.shareFab}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void shareItem(item);
              }}
            >
              <Send size={12} color="#334155" />
            </Pressable>
            {Boolean(item.whatsapp || item.phone) && (
              <Pressable
                hitSlop={8}
                style={[styles.shareFab, { backgroundColor: '#25D366' }]}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  openWhatsApp(item.whatsapp || item.phone, `مرحباً، شفت عرضك «${item.name}» في سوق الحي بحيّنا وحاب أستفسر`);
                }}
              >
                <MessageCircle size={13} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.shop_name ? `🏪 ${item.shop_name}` : (item.subcategory || item.profiles?.display_name || item.category || 'عرض محلي')}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardPrice} numberOfLines={1}>{formatServicePrice(item)}</Text>
            {modes.length > 0 && <Text style={styles.cardModes}>{modes.map((m) => getDeliveryMode(m)?.emoji).join('')}</Text>}
          </View>

          <View style={styles.cardMeta}>
            {item.profiles?.is_verified && <ShieldCheck size={12} color="#10b981" />}
            <MapPin size={10} color="#94a3b8" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {type?.nationwide ? 'عن بُعد' : (item.district || item.profiles?.district) ? `حي ${item.district || item.profiles?.district}` : (item.city || 'داخل الحي')}
            </Text>
            {Boolean(timeAgo) && <Text style={styles.cardTimeText}>· {timeAgo}</Text>}
          </View>

          <View style={styles.cardDetailsHintRow}>
            <Text style={styles.cardDetailsHintText}>عرض التفاصيل الكاملة</Text>
            <ArrowRight size={11} color="#059669" />
          </View>
        </View>
      </Pressable>
    );
  };

  // Render Card: Local Business / Store Directory
  const renderBusinessCard = (b: any, w: number) => {
    const isSaved = Boolean(savedItems[b.id]);

    return (
      <Pressable
        key={b.id}
        onPress={() => setSelectedBusiness(b)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={[styles.cardImage, { height: w * 0.58, backgroundColor: b.bg || '#f0f9ff' }]}>
          <Text style={{ fontSize: Math.min(38, w * 0.22) }}>{b.icon || '🏬'}</Text>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
            <Text style={[styles.typeBadgeText, { color: b.color || '#0284c7' }]}>{b.categoryLabel}</Text>
          </View>
          {b.openNow && (
            <View style={styles.availableBadgePill}>
              <View style={styles.availableDot} />
              <Text style={styles.availableBadgeText}>مفتوح</Text>
            </View>
          )}
          <View style={styles.cardTopActions}>
            <Pressable
              hitSlop={8}
              style={[styles.shareFab, isSaved && { backgroundColor: '#fef2f2' }]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                toggleSaveItem(b.id);
              }}
            >
              <Heart size={13} color={isSaved ? '#ef4444' : '#475569'} fill={isSaved ? '#ef4444' : 'none'} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.shareFab}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void shareBusiness(b);
              }}
            >
              <Share2 size={12} color="#334155" />
            </Pressable>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{b.name}</Text>
              {b.is_verified && <ShieldCheck size={13} color="#059669" />}
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
              <Star size={11} color="#f59e0b" fill="#f59e0b" />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>{b.rating}</Text>
              <Text style={{ fontSize: 9.5, color: '#94a3b8' }}>({b.reviews})</Text>
            </View>
          </View>

          <Text style={styles.cardSub} numberOfLines={2}>{b.description || b.hours}</Text>

          <View style={[styles.cardMeta, { marginTop: 6 }]}>
            <MapPin size={10} color="#059669" />
            <Text style={[styles.cardMetaText, { color: '#475569' }]} numberOfLines={1}>
              {b.district ? `حي ${b.district}` : ''} {b.city ? `· ${b.city}` : ''}
            </Text>
          </View>

          {/* Quick Contact & Action Buttons */}
          <View style={styles.businessActionsRow}>
            {Boolean(b.phone) && (
              <Pressable
                style={styles.bizBtnCall}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  openPhone(b.phone);
                }}
              >
                <Phone size={12} color="#0284c7" />
                <Text style={styles.bizBtnCallText}>اتصال</Text>
              </Pressable>
            )}
            {Boolean(b.whatsapp) && (
              <Pressable
                style={styles.bizBtnWa}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  openWhatsApp(b.whatsapp, `مرحباً «${b.name}»، شفت دليلكم في تطبيق حيّنا وحاب أستفسر`);
                }}
              >
                <MessageCircle size={12} color="#15803d" />
                <Text style={styles.bizBtnWaText}>واتساب</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.bizBtnMap}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                openMaps(`${b.name} ${b.district || ''} ${b.city || ''}`);
              }}
            >
              <Navigation size={12} color="#475569" />
              <Text style={styles.bizBtnMapText}>الخريطة</Text>
            </Pressable>
          </View>

          <View style={styles.cardDetailsHintRow}>
            <Text style={[styles.cardDetailsHintText, { color: '#0284c7' }]}>عرض بطاقة المحل والخدمات</Text>
            <ArrowRight size={11} color="#0284c7" />
          </View>
        </View>
      </Pressable>
    );
  };

  // Render Card: Neighborhood Community Event
  const renderEventCard = (ev: any, w: number) => {
    const isAttending = Boolean(rsvpList[ev.id]);
    const currentCount = ev.attendeesCount + (isAttending ? 1 : 0);

    return (
      <Pressable
        key={ev.id}
        onPress={() => setSelectedEvent(ev)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={[styles.cardImage, { height: w * 0.58, backgroundColor: ev.bg || '#ecfdf5' }]}>
          <Text style={{ fontSize: Math.min(38, w * 0.22) }}>{ev.icon || '🗓️'}</Text>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
            <Text style={[styles.typeBadgeText, { color: ev.color || '#059669' }]}>{ev.categoryLabel}</Text>
          </View>
          <View style={[styles.availableBadgePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <Text style={[styles.availableBadgeText, { color: '#047857' }]}>{ev.isFree ? 'مجاني 🎟️' : 'تسجيل'}</Text>
          </View>
          <View style={styles.cardTopActions}>
            <Pressable
              hitSlop={8}
              style={styles.shareFab}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void shareEvent(ev);
              }}
            >
              <Share2 size={12} color="#334155" />
            </Pressable>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{ev.title}</Text>
          <Text style={styles.cardSub} numberOfLines={2}>{ev.description}</Text>

          <View style={styles.eventInfoBox}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Clock size={11} color="#d97706" />
              <Text style={styles.eventInfoText} numberOfLines={1}>{ev.dateLabel}</Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <MapPin size={11} color="#059669" />
              <Text style={styles.eventInfoText} numberOfLines={1}>{ev.location}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Users size={12} color="#64748b" />
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
                {currentCount} جار مشارك
              </Text>
            </View>

            <Pressable
              style={[styles.rsvpBtn, isAttending && styles.rsvpBtnActive]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                toggleRsvp(ev.id);
              }}
            >
              {isAttending ? <Check size={12} color="#fff" /> : <Sparkles size={12} color="#059669" />}
              <Text style={[styles.rsvpBtnText, isAttending && { color: '#fff' }]}>
                {isAttending ? 'سأحضر ✓' : 'حضور'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.cardDetailsHintRow}>
            <Text style={[styles.cardDetailsHintText, { color: '#059669' }]}>عرض تفاصيل الفعالية والبرنامج</Text>
            <ArrowRight size={11} color="#059669" />
          </View>
        </View>
      </Pressable>
    );
  };

  const locationLabel = isAllKingdom(activeLoc.city)
    ? 'كل مناطق المملكة'
    : activeLoc.city + (activeLoc.district !== 'كل الأحياء' ? ' · حي ' + activeLoc.district : '');

  // Add Button Action based on current section
  const handleAddPress = () => {
    if (section === 'market') {
      router.push('/new-service');
    } else if (section === 'businesses') {
      router.push('/new-service');
    } else {
      setShowEventModal(true);
    }
  };

  const addBtnLabel = section === 'market' ? 'أضف عرضك' : section === 'businesses' ? 'أضف محلك' : 'أضف فعالية';

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 24 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAllData} tintColor="#059669" />}
      >
        {/* Premium Executive Hero Header */}
        <LinearGradient
          colors={['#064e3b', '#065f46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          <View style={styles.inner}>
            <View style={styles.topRow}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.headerTitle}>سوق وخدمات الحي</Text>
                  <View style={styles.proBadge}>
                    <Sparkles size={11} color="#fef08a" />
                    <Text style={styles.proBadgeText}>موثّق</Text>
                  </View>
                </View>
                <Pressable onPress={() => router.push('/locations')} style={styles.locRow}>
                  <MapPin size={13} color="#6ee7b7" />
                  <Text style={styles.locText} numberOfLines={1}>{locationLabel}</Text>
                  <ChevronDown size={12} color="#a7f3d0" />
                </Pressable>
              </View>

              <View style={styles.headerActions}>
                <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
                  <Bell size={18} color="#fff" />
                  {unreadNotifCount > 0 && (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
                    </View>
                  )}
                  {profile?.is_geoverified && (
                    <View style={styles.avatarVerified}>
                      <ShieldCheck size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Live Neighborhood KPI Strip */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <ShoppingBag size={14} color="#6ee7b7" />
                <Text style={styles.kpiVal}>{inAreaMarket.length}</Text>
                <Text style={styles.kpiLbl}>عروض نشطة</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Store size={14} color="#6ee7b7" />
                <Text style={styles.kpiVal}>{displayedBusinesses.length}</Text>
                <Text style={styles.kpiLbl}>محلات ومتاجر</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <Calendar size={14} color="#6ee7b7" />
                <Text style={styles.kpiVal}>{displayedEvents.length}</Text>
                <Text style={styles.kpiLbl}>فعاليات قادمة</Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiItem}>
                <ShieldCheck size={14} color="#6ee7b7" />
                <Text style={styles.kpiVal}>100%</Text>
                <Text style={styles.kpiLbl}>مجتمع موثوق</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Sticky Search & Section Segment Switcher */}
        <View style={styles.stickyWrap}>
          <View style={styles.inner}>
            {/* Primary Segment Control */}
            <View style={styles.segmentWrap}>
              <Pressable
                onPress={() => setSection('market')}
                style={[styles.segmentBtn, section === 'market' && styles.segmentBtnActive]}
              >
                <ShoppingBag size={14} color={section === 'market' ? '#fff' : '#64748b'} />
                <Text style={[styles.segmentText, section === 'market' && styles.segmentTextActive]}>سوق الحي والأسر</Text>
                <View style={[styles.segmentCount, section === 'market' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'market' && styles.segmentCountTextActive]}>
                    {inAreaMarket.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setSection('businesses')}
                style={[styles.segmentBtn, section === 'businesses' && styles.segmentBtnActive]}
              >
                <Building2 size={14} color={section === 'businesses' ? '#fff' : '#64748b'} />
                <Text style={[styles.segmentText, section === 'businesses' && styles.segmentTextActive]}>دليل المحلات والأنشطة</Text>
                <View style={[styles.segmentCount, section === 'businesses' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'businesses' && styles.segmentCountTextActive]}>
                    {displayedBusinesses.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setSection('events')}
                style={[styles.segmentBtn, section === 'events' && styles.segmentBtnActive]}
              >
                <Calendar size={14} color={section === 'events' ? '#fff' : '#64748b'} />
                <Text style={[styles.segmentText, section === 'events' && styles.segmentTextActive]}>ملتقيات وفعاليات</Text>
                <View style={[styles.segmentCount, section === 'events' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'events' && styles.segmentCountTextActive]}>
                    {displayedEvents.length}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Contextual Search Input & Action Button */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  id="market-search"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={
                    section === 'market'
                      ? 'ابحث عن منتج، سلعة، أو أسر منتجة...'
                      : section === 'businesses'
                      ? 'ابحث عن بقالة، صيدلية، مطعم، ورشة...'
                      : 'ابحث في فعاليات وملتقيات الحي...'
                  }
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  textAlign="right"
                />
                {!!searchQuery && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <X size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              <Pressable id="market-add" style={styles.addBtn} onPress={handleAddPress}>
                <Plus size={18} color="#fff" />
                {width > 360 && <Text style={styles.addBtnText}>{addBtnLabel}</Text>}
              </Pressable>
            </View>

            {/* Smart Sorting Bar */}
            <View style={styles.sortBar}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                <ArrowUpDown size={12} color="#64748b" />
                <Text style={styles.sortBarLabel}>ترتيب:</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6 }}>
                {SORT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setSortBy(opt.id)}
                    style={[styles.sortChip, sortBy === opt.id && styles.sortChipActive]}
                  >
                    <Text style={{ fontSize: 10 }}>{opt.icon}</Text>
                    <Text style={[styles.sortChipText, sortBy === opt.id && styles.sortChipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <View style={styles.inner}>
          {loading ? (
            <ScreenState type="loading" title="جاري التجهيز والتحميل" message="نرتب لك محتوى الحي الأقرب إليك" />
          ) : loadError ? (
            <View style={{ paddingVertical: 24 }}>
              <ScreenState type="error" title="تعذر تحميل المحتوى" message="اسحب للتحديث وحاول مرة أخرى" />
            </View>
          ) : (
            <>

              {/* ======================================================== */}
              {/* SECTION 1: MARKET & FAMILY BUSINESSES                    */}
              {/* ======================================================== */}
              {section === 'market' && (
                <>
                  {/* Category Circles */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typesRow} style={styles.typesScroll}>
                    <TypeCircle
                      label="الكل" active={activeType === 'all'} color="#059669" bg="#ecfdf5"
                      Icon={LayoutGrid} count={inAreaMarket.length} onPress={() => setActiveType('all')}
                    />
                    {LISTING_TYPES.map((t) => (
                      <TypeCircle
                        key={t.id} label={t.short} active={activeType === t.id} color={t.color} bg={t.bg}
                        Icon={t.Icon} count={typeCounts[t.id] || 0}
                        onPress={() => setActiveType(activeType === t.id ? 'all' : t.id)}
                      />
                    ))}
                  </ScrollView>

                  {/* Quick Filter Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                    {QUICK_FILTERS.map((f) => (
                      <Pressable key={f.id} onPress={() => setQuick(f.id)} style={[styles.quickChip, quick === f.id && styles.quickChipActive]}>
                        <Text style={[styles.quickText, quick === f.id && styles.quickTextActive]}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* Productive Families Spotlight */}
                  {families.length > 0 && (
                    <View style={{ marginBottom: 18 }}>
                      <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle}>🏠 من الأسر المنتجة في حيّك</Text>
                        <Pressable onPress={() => setActiveType('home_family')}>
                          <Text style={styles.seeAll}>عرض الكل</Text>
                        </Pressable>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap }}>
                        {families.map((e) => renderMarketCard(e, Math.min(160, cardWidth)))}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>
                      {activeType === 'all' ? 'أحدث العروض والسلع' : LISTING_TYPES.find((t) => t.id === activeType)?.label}
                    </Text>
                    <Text style={styles.resultCount}>{displayedMarket.length} عرض</Text>
                  </View>

                  {displayedMarket.length > 0 ? (
                    <View style={[styles.grid, { gap }]}>
                      {displayedMarket.map((e) => renderMarketCard(e, cardWidth))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={styles.emptyIcon}><ShoppingBag size={30} color="#10b981" /></View>
                      <Text style={styles.emptyTitle}>لا توجد عروض هنا بعد</Text>
                      <Text style={styles.emptyText}>
                        {!isAllKingdom(activeLoc.city) ? `كن أول من يضيف عرضاً في ${locationLabel}` : 'جرّب قسماً آخر أو غيّر البحث'}
                      </Text>
                      <Pressable style={styles.emptyBtn} onPress={() => router.push('/new-service')}>
                        <Plus size={16} color="#fff" />
                        <Text style={styles.emptyBtnText}>أضف عرضك</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* SECTION 2: BUSINESS DIRECTORY & LOCAL SERVICES           */}
              {/* ======================================================== */}
              {section === 'businesses' && (
                <>
                  {/* Category Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow} style={{ marginTop: 12 }}>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => setBusinessCategory(c.id)}
                        style={[styles.quickChip, businessCategory === c.id && styles.quickChipActive]}
                      >
                        <Text style={[styles.quickText, businessCategory === c.id && styles.quickTextActive]}>
                          {c.emoji} {c.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>المحلات والأنشطة التجارية في الحي</Text>
                    <Text style={styles.resultCount}>{displayedBusinesses.length} منشأة</Text>
                  </View>

                  {displayedBusinesses.length > 0 ? (
                    <View style={[styles.grid, { gap }]}>
                      {displayedBusinesses.map((b) => renderBusinessCard(b, cardWidth))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={[styles.emptyIcon, { backgroundColor: '#f0f9ff' }]}><Building2 size={30} color="#0284c7" /></View>
                      <Text style={styles.emptyTitle}>لا توجد محلات مسجلة في هذا التصنيف</Text>
                      <Text style={styles.emptyText}>أضف محلك أو متجرك ليظهر لكافة سكان الحي مجاناً.</Text>
                      <Pressable style={[styles.emptyBtn, { backgroundColor: '#0284c7' }]} onPress={() => router.push('/new-service')}>
                        <Plus size={16} color="#fff" />
                        <Text style={styles.emptyBtnText}>أضف محلك التجاري</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* SECTION 3: NEIGHBORHOOD EVENTS & ACTIVITIES             */}
              {/* ======================================================== */}
              {section === 'events' && (
                <>
                  {/* Event Category Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow} style={{ marginTop: 12 }}>
                    {EVENT_CATEGORIES.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => setEventCategory(c.id)}
                        style={[styles.quickChip, eventCategory === c.id && styles.quickChipActive]}
                      >
                        <Text style={[styles.quickText, eventCategory === c.id && styles.quickTextActive]}>
                          {c.emoji} {c.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>فعاليات وأنشطة الحي القادمة</Text>
                    <Text style={styles.resultCount}>{displayedEvents.length} فعالية</Text>
                  </View>

                  {displayedEvents.length > 0 ? (
                    <View style={[styles.grid, { gap }]}>
                      {displayedEvents.map((ev) => renderEventCard(ev, cardWidth))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={[styles.emptyIcon, { backgroundColor: '#fffbeb' }]}><Calendar size={30} color="#d97706" /></View>
                      <Text style={styles.emptyTitle}>لا توجد فعاليات في هذا التصنيف حالياً</Text>
                      <Text style={styles.emptyText}>بادر بتنظيم نشاط أو ملتقى وشارك جيرانك الأوقات الطيبة.</Text>
                      <Pressable style={[styles.emptyBtn, { backgroundColor: '#d97706' }]} onPress={() => setShowEventModal(true)}>
                        <Plus size={16} color="#fff" />
                        <Text style={styles.emptyBtnText}>أضف فعالية للحي</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL 1: FULL BUSINESS & STORE DETAILS                   */}
      {/* ======================================================== */}
      {selectedBusiness && (
        <Modal visible={!!selectedBusiness} animationType="slide" transparent onRequestClose={() => setSelectedBusiness(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedBusiness(null)} style={styles.modalCloseBtn}>
                  <X size={18} color="#0f172a" />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Store size={18} color="#0284c7" />
                  <Text style={styles.modalTitle}>تفاصيل المحل والخدمة 🏬</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Hero Card Head */}
                <View style={[styles.detailHeroBox, { backgroundColor: selectedBusiness.bg || '#f0f9ff' }]}>
                  <View style={styles.detailHeroIconCircle}>
                    <Text style={{ fontSize: 36 }}>{selectedBusiness.icon || '🏬'}</Text>
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.detailHeroTitle}>{selectedBusiness.name}</Text>
                      {selectedBusiness.is_verified && <ShieldCheck size={18} color="#059669" />}
                    </View>
                    <View style={styles.detailBadgeRow}>
                      <Text style={[styles.detailCatPill, { color: selectedBusiness.color || '#0284c7' }]}>
                        {selectedBusiness.categoryLabel}
                      </Text>
                      <View style={styles.detailRatingPill}>
                        <Star size={13} color="#f59e0b" fill="#f59e0b" />
                        <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{selectedBusiness.rating}</Text>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>({selectedBusiness.reviews} تقييم)</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Status & Timing Banner */}
                <View style={styles.detailStatusBanner}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color="#059669" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                      {selectedBusiness.hours || 'متاح لخدمة الحي'}
                    </Text>
                  </View>
                  <View style={[styles.statusTag, selectedBusiness.openNow ? styles.statusTagOpen : styles.statusTagClosed]}>
                    <Text style={[styles.statusTagText, selectedBusiness.openNow ? { color: '#15803d' } : { color: '#b91c1c' }]}>
                      {selectedBusiness.openNow ? 'مفتوح الآن 🟢' : 'مغلق حالياً 🔴'}
                    </Text>
                  </View>
                </View>

                {/* Location Bar */}
                <View style={styles.detailLocationBanner}>
                  <MapPin size={16} color="#059669" />
                  <Text style={styles.detailLocationText}>
                    الموقع: {selectedBusiness.district ? `حي ${selectedBusiness.district}` : ''} {selectedBusiness.city ? `· مدينة ${selectedBusiness.city}` : ''}
                  </Text>
                </View>

                {/* Quick Action Grid */}
                <View style={styles.detailActionsGrid}>
                  {Boolean(selectedBusiness.phone) && (
                    <Pressable style={styles.detailActionBtnCall} onPress={() => openPhone(selectedBusiness.phone)}>
                      <Phone size={16} color="#0284c7" />
                      <Text style={styles.detailActionBtnCallText}>اتصال مباشر</Text>
                    </Pressable>
                  )}
                  {Boolean(selectedBusiness.whatsapp) && (
                    <Pressable
                      style={styles.detailActionBtnWa}
                      onPress={() => openWhatsApp(selectedBusiness.whatsapp, `مرحباً «${selectedBusiness.name}»، شفت بطاقة محلكم في تطبيق حيّنا وحاب أستفسر عن الخدمات`)}
                    >
                      <MessageCircle size={16} color="#15803d" />
                      <Text style={styles.detailActionBtnWaText}>محادثة واتساب</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.detailActionBtnMap}
                    onPress={() => openMaps(`${selectedBusiness.name} ${selectedBusiness.district || ''} ${selectedBusiness.city || ''}`)}
                  >
                    <Navigation size={16} color="#059669" />
                    <Text style={styles.detailActionBtnMapText}>خرائط Google</Text>
                  </Pressable>
                  <Pressable style={styles.detailActionBtnShare} onPress={() => void shareBusiness(selectedBusiness)}>
                    <Share2 size={16} color="#475569" />
                    <Text style={styles.detailActionBtnShareText}>مشاركة</Text>
                  </Pressable>
                </View>

                {/* About & Description */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>نبذة عن المنشأة ℹ️</Text>
                  <Text style={styles.detailSectionDesc}>
                    {selectedBusiness.description || 'منشأة تجارية معتمدة تقدم خدماتها المتميزة لسكان الحي مع التزام بأعلى معايير الجودة والمصداقية.'}
                  </Text>
                </View>

                {/* Features & Advantages */}
                {selectedBusiness.features && selectedBusiness.features.length > 0 && (
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>المميزات والخدمات المقدمة ⭐</Text>
                    <View style={{ gap: 8, marginTop: 6 }}>
                      {selectedBusiness.features.map((feat: string, idx: number) => (
                        <View key={idx} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={16} color="#059669" />
                          <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>{feat}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Services List if available */}
                {selectedBusiness.servicesList && (
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>قائمة الخدمات المتاحة 📋</Text>
                    <View style={{ gap: 10, marginTop: 8 }}>
                      {selectedBusiness.servicesList.map((svc: any, idx: number) => (
                        <View key={idx} style={styles.detailServiceRow}>
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0f172a' }}>{svc.name}</Text>
                          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{svc.desc}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Neighbor Reviews */}
                {selectedBusiness.reviewsList && selectedBusiness.reviewsList.length > 0 && (
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>آراء الجيران وتقييماتهم 💬</Text>
                    <View style={{ gap: 10, marginTop: 8 }}>
                      {selectedBusiness.reviewsList.map((rev: any, idx: number) => (
                        <View key={idx} style={styles.detailReviewRow}>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#0f172a' }}>{rev.user}</Text>
                            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
                              <Star size={11} color="#f59e0b" fill="#f59e0b" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>{rev.rating}</Text>
                              <Text style={{ fontSize: 10, color: '#94a3b8' }}>· {rev.time}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 18 }}>{rev.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: FULL COMMUNITY EVENT DETAILS                    */}
      {/* ======================================================== */}
      {selectedEvent && (
        <Modal visible={!!selectedEvent} animationType="slide" transparent onRequestClose={() => setSelectedEvent(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedEvent(null)} style={styles.modalCloseBtn}>
                  <X size={18} color="#0f172a" />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Calendar size={18} color="#059669" />
                  <Text style={styles.modalTitle}>تفاصيل الفعالية والنشاط 🗓️</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Event Hero Box */}
                <View style={[styles.detailHeroBox, { backgroundColor: selectedEvent.bg || '#ecfdf5' }]}>
                  <View style={styles.detailHeroIconCircle}>
                    <Text style={{ fontSize: 36 }}>{selectedEvent.icon || '🗓️'}</Text>
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
                    <Text style={styles.detailHeroTitle}>{selectedEvent.title}</Text>
                    <View style={styles.detailBadgeRow}>
                      <Text style={[styles.detailCatPill, { color: selectedEvent.color || '#059669' }]}>
                        {selectedEvent.categoryLabel}
                      </Text>
                      <View style={[styles.detailRatingPill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                        <Award size={13} color="#059669" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>
                          {selectedEvent.isFree ? 'دخول مجاني 🎟️' : 'تسجيل مسبق'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Organizer Info */}
                <View style={styles.detailStatusBanner}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Users size={16} color="#059669" />
                    <View>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>الجهة المنظمة</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{selectedEvent.organizer || 'أحد سكان الحي'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                    <Users size={14} color="#059669" />
                    <Text style={{ fontSize: 12.5, fontWeight: '900', color: '#059669' }}>
                      {selectedEvent.attendeesCount + (rsvpList[selectedEvent.id] ? 1 : 0)} جار مسجل
                    </Text>
                  </View>
                </View>

                {/* Timing & Schedule */}
                <View style={styles.detailLocationBanner}>
                  <Clock size={16} color="#d97706" />
                  <Text style={[styles.detailLocationText, { color: '#92400e' }]}>
                    الموعد: {selectedEvent.dateLabel}
                  </Text>
                </View>

                {/* Exact Location */}
                <View style={styles.detailLocationBanner}>
                  <MapPin size={16} color="#059669" />
                  <Text style={styles.detailLocationText}>
                    نقطة التجمع: {selectedEvent.location} ({selectedEvent.district ? `حي ${selectedEvent.district}` : selectedEvent.city || ''})
                  </Text>
                </View>

                {/* RSVP Interactive Button */}
                <View style={{ marginVertical: 12 }}>
                  <Pressable
                    style={[styles.bigRsvpBtn, rsvpList[selectedEvent.id] && styles.bigRsvpBtnActive]}
                    onPress={() => toggleRsvp(selectedEvent.id)}
                  >
                    {rsvpList[selectedEvent.id] ? (
                      <>
                        <Check size={20} color="#fff" />
                        <Text style={styles.bigRsvpBtnText}>تم تسجيل حضورك بنجاح ✓ (انقر للإلغاء)</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} color="#fff" />
                        <Text style={styles.bigRsvpBtnText}>تسجيل الحضور في الفعالية (سأحضر 🎉)</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Actions: Map & Share */}
                <View style={styles.detailActionsGrid}>
                  <Pressable
                    style={styles.detailActionBtnMap}
                    onPress={() => openMaps(`${selectedEvent.location} ${selectedEvent.district || ''} ${selectedEvent.city || ''}`)}
                  >
                    <Navigation size={16} color="#059669" />
                    <Text style={styles.detailActionBtnMapText}>عرض موقع الفعالية بالخريطة</Text>
                  </Pressable>
                  <Pressable style={styles.detailActionBtnShare} onPress={() => void shareEvent(selectedEvent)}>
                    <Share2 size={16} color="#475569" />
                    <Text style={styles.detailActionBtnShareText}>مشاركة الدعوة مع الجيران</Text>
                  </Pressable>
                </View>

                {/* Description */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>عن الفعالية والنشاط ℹ️</Text>
                  <Text style={styles.detailSectionDesc}>{selectedEvent.description}</Text>
                </View>

                {/* Agenda if available */}
                {selectedEvent.agenda && (
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>برنامج الفعالية والجدول ⏱️</Text>
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {selectedEvent.agenda.map((item: string, idx: number) => (
                        <View key={idx} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' }} />
                          <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Guidelines */}
                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>إرشادات وتعليمات الحضور 📌</Text>
                  <Text style={styles.detailSectionDesc}>
                    {selectedEvent.guidelines || 'مرحباً بجميع أهالي الحي، الفعالية مجانية، والدعوة عامة لك ولأسرتك.'}
                  </Text>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: QUICK PRODUCT / SERVICE PREVIEW                 */}
      {/* ======================================================== */}
      {selectedProduct && (
        <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedProduct(null)} style={styles.modalCloseBtn}>
                  <X size={18} color="#0f172a" />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={18} color="#059669" />
                  <Text style={styles.modalTitle}>تفاصيل العرض والسلعة 🛍️</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Product Cover Image */}
                {getServiceCover(selectedProduct) ? (
                  <View style={styles.productModalImgWrap}>
                    <Image source={{ uri: getServiceCover(selectedProduct)! }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  </View>
                ) : null}

                <View style={{ paddingVertical: 12 }}>
                  <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.productModalTitle}>{selectedProduct.name}</Text>
                    <Text style={styles.productModalPrice}>{formatServicePrice(selectedProduct)}</Text>
                  </View>

                  <Text style={styles.productModalSub}>
                    {selectedProduct.shop_name ? `🏪 ${selectedProduct.shop_name}` : selectedProduct.subcategory || selectedProduct.category || 'عرض محلي'}
                  </Text>

                  {/* Delivery & Status row */}
                  <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {selectedProduct.available_now && (
                      <View style={[styles.statusTag, styles.statusTagOpen]}>
                        <Text style={[styles.statusTagText, { color: '#15803d' }]}>متاح الآن للتسليم 🟢</Text>
                      </View>
                    )}
                    {(selectedProduct.delivery_modes || []).map((m: string) => {
                      const dm = getDeliveryMode(m);
                      return dm ? (
                        <View key={m} style={styles.deliveryPill}>
                          <Text style={{ fontSize: 12 }}>{dm.emoji}</Text>
                          <Text style={styles.deliveryPillText}>{dm.label}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>

                  {/* Location Info */}
                  <View style={[styles.detailLocationBanner, { marginTop: 12 }]}>
                    <MapPin size={16} color="#059669" />
                    <Text style={styles.detailLocationText}>
                      الموقع: {selectedProduct.district ? `حي ${selectedProduct.district}` : ''} {selectedProduct.city ? `· ${selectedProduct.city}` : 'داخل الحي'}
                    </Text>
                  </View>

                  {/* Description */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>وصف السلعة والتفاصيل 📝</Text>
                    <Text style={styles.detailSectionDesc}>
                      {selectedProduct.description || 'عرض متاح من أحد سكان أو أسر الحي، تم فحصه لضمان أفضل تجربة.'}
                    </Text>
                  </View>

                  {/* Provider Info */}
                  {selectedProduct.profiles && (
                    <View style={styles.detailStatusBanner}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                        {selectedProduct.profiles.avatar_url ? (
                          <Image source={{ uri: selectedProduct.profiles.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                        ) : (
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857' }}>
                              {selectedProduct.profiles.display_name?.[0] || 'ج'}
                            </Text>
                          </View>
                        )}
                        <View>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                              {selectedProduct.profiles.display_name || 'أحد الجيران'}
                            </Text>
                            {selectedProduct.profiles.is_verified && <ShieldCheck size={14} color="#059669" />}
                          </View>
                          <Text style={{ fontSize: 11, color: '#64748b' }}>معلن موثق بالحي</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Direct Contact Buttons */}
                  <View style={styles.detailActionsGrid}>
                    {Boolean(selectedProduct.whatsapp || selectedProduct.phone) && (
                      <Pressable
                        style={styles.detailActionBtnWa}
                        onPress={() => openWhatsApp(selectedProduct.whatsapp || selectedProduct.phone, `مرحباً، بخصوص إعلانك «${selectedProduct.name}» في سوق الحي بحيّنا، هل هو متاح؟`)}
                      >
                        <MessageCircle size={16} color="#15803d" />
                        <Text style={styles.detailActionBtnWaText}>محادثة واتساب</Text>
                      </Pressable>
                    )}
                    {Boolean(selectedProduct.phone) && (
                      <Pressable style={styles.detailActionBtnCall} onPress={() => openPhone(selectedProduct.phone)}>
                        <Phone size={16} color="#0284c7" />
                        <Text style={styles.detailActionBtnCallText}>اتصال</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.detailActionBtnShare} onPress={() => void shareItem(selectedProduct)}>
                      <Share2 size={16} color="#475569" />
                      <Text style={styles.detailActionBtnShareText}>مشاركة</Text>
                    </Pressable>
                  </View>

                  {/* Open Full Dedicated Page Button */}
                  <Pressable
                    style={styles.fullPageBtn}
                    onPress={() => {
                      setSelectedProduct(null);
                      router.push({ pathname: '/service', params: { id: selectedProduct.id } });
                    }}
                  >
                    <ExternalLink size={16} color="#fff" />
                    <Text style={styles.fullPageBtnText}>فتح صفحة العرض المخصصة كاملة</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ADD COMMUNITY EVENT                             */}
      {/* ======================================================== */}
      <Modal visible={showEventModal} animationType="slide" transparent onRequestClose={() => setShowEventModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowEventModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#0f172a" />
              </Pressable>
              <Text style={styles.modalTitle}>إضافة فعالية جديدة للحي 📅</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              <Text style={styles.inputLabel}>عنوان الفعالية *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="مثال: ملتقى سكان الحي الأسبوعي، دوري كرة القدم..."
                placeholderTextColor="#94a3b8"
                value={eventTitle}
                onChangeText={setEventTitle}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>تصنيف الفعالية</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 6, paddingVertical: 4 }}>
                {EVENT_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setEventCategoryChoice(c.id)}
                    style={[styles.quickChip, eventCategoryChoice === c.id && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickText, eventCategoryChoice === c.id && styles.quickTextActive]}>
                      {c.emoji} {c.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>الموعد والتاريخ *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="مثال: الجمعة القادمة بعد صلاة العصر (4:30 م)"
                placeholderTextColor="#94a3b8"
                value={eventDate}
                onChangeText={setEventDate}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>المكان أو نقطة التجمع *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="مثال: حديقة الحي، ممشى الحي، قاعة جامع الحي"
                placeholderTextColor="#94a3b8"
                value={eventLocation}
                onChangeText={setEventLocation}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>تفاصيل الفعالية وبرنامجها</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                placeholder="اكتب نبذة عن الفعالية، الأنشطة، وهل الحضور مجاني..."
                placeholderTextColor="#94a3b8"
                value={eventDesc}
                onChangeText={setEventDesc}
                multiline
              />

              <Pressable
                style={[styles.submitEventBtn, savingEvent && { opacity: 0.6 }]}
                onPress={handleCreateEvent}
                disabled={savingEvent}
              >
                {savingEvent ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Calendar size={18} color="#fff" />
                    <Text style={styles.submitEventBtnText}>نشر الفعالية لسكان الحي 📢</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TypeCircle({ label, active, color, bg, Icon, count, onPress }: {
  label: string; active: boolean; color: string; bg: string; Icon: any; count: number; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.typeItem, pressed && { opacity: 0.75 }]}>
      <View style={[styles.typeCircle, { backgroundColor: active ? color : bg }, active && styles.typeCircleActive]}>
        <Icon size={22} color={active ? '#fff' : color} />
        {count > 0 && (
          <View style={[styles.typeCount, { borderColor: active ? color : '#fff' }]}>
            <Text style={styles.typeCountText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.typeLabel, active && { color, fontWeight: '900' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', width: '100%' },
  inner: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 16 },

  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  proBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  proBadgeText: { fontSize: 10, fontWeight: '900', color: '#fef08a' },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4, maxWidth: 240 },
  locText: { fontSize: 12.5, color: '#d1fae5', fontWeight: '700', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  notifBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: '900' },
  avatarWrap: { width: 40, height: 40 },
  avatarImg: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#6ee7b7' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#6ee7b7' },
  avatarLetter: { color: '#fff', fontSize: 16, fontWeight: '900' },
  avatarVerified: { position: 'absolute', right: -2, bottom: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

  // Live Neighborhood KPI Strip
  kpiRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  kpiItem: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: 13.5, fontWeight: '900', color: '#fff' },
  kpiLbl: { fontSize: 9.5, color: '#a7f3d0', fontWeight: '700' },
  kpiDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' },

  stickyWrap: { backgroundColor: '#fff', paddingBottom: 10, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },

  // Sort Bar
  sortBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sortBarLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  sortChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  sortChipText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  sortChipTextActive: { color: '#fff', fontWeight: '800' },

  // Segment Controller
  segmentWrap: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  segmentCount: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  segmentCountTextActive: {
    color: '#fff',
  },

  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: '#f1f5f9', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  addBtn: { height: 46, minWidth: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#059669', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Live Pulse Banner
  pulseBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  pulseText: { fontSize: 11.5, fontWeight: '800', color: '#047857', flex: 1, textAlign: 'right' },

  typesScroll: { marginTop: 14 },
  typesRow: { flexDirection: 'row-reverse', gap: 14, paddingBottom: 4 },
  typeItem: { alignItems: 'center', width: 64 },
  typeCircle: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  typeCircleActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  typeCount: { position: 'absolute', top: -4, left: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  typeCountText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  typeLabel: { fontSize: 11.5, color: '#475569', fontWeight: '700', marginTop: 6 },

  quickRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 },
  quickChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quickChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  quickText: { fontSize: 12.5, color: '#475569', fontWeight: '700' },
  quickTextActive: { color: '#fff' },

  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  seeAll: { fontSize: 12.5, color: '#059669', fontWeight: '800' },
  resultCount: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },

  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7',
    ...(Platform.OS === 'web' ? ({ transition: 'transform 160ms ease, box-shadow 160ms ease', cursor: 'pointer' } as any) : {}),
  },
  cardHover: { transform: [{ translateY: -3 }], shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  cardImage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  typeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '900' },
  availableBadgePill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  availableBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#15803d' },
  cardTopActions: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', gap: 5 },
  shareFab: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10, paddingTop: 9 },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  cardSub: { fontSize: 11.5, color: '#64748b', textAlign: 'right', marginTop: 2, lineHeight: 16 },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 4 },
  cardPrice: { fontSize: 13.5, fontWeight: '900', color: '#059669', flexShrink: 1 },
  cardModes: { fontSize: 11 },
  cardTimeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  cardMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 6 },
  cardMetaText: { fontSize: 10.5, color: '#94a3b8', fontWeight: '600', flexShrink: 1 },
  cardDetailsHintRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  cardDetailsHintText: { fontSize: 11, fontWeight: '800', color: '#059669' },

  // Business Card Action Buttons
  businessActionsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  bizBtnCall: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  bizBtnCallText: { fontSize: 11, fontWeight: '800', color: '#0284c7' },
  bizBtnWa: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bizBtnWaText: { fontSize: 11, fontWeight: '800', color: '#15803d' },
  bizBtnMap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bizBtnMapText: { fontSize: 11, fontWeight: '800', color: '#475569' },

  // Event Card Elements
  eventInfoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  eventInfoText: { fontSize: 11, color: '#334155', fontWeight: '700' },
  rsvpBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  rsvpBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  rsvpBtnText: { fontSize: 11, fontWeight: '900', color: '#059669' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eef2f7' },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginTop: 12 },
  emptyText: { fontSize: 12.5, color: '#94a3b8', marginTop: 4, textAlign: 'center', lineHeight: 18 },
  emptyBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#059669', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Modals Core
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0f172a', textAlign: 'right' },
  submitEventBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: 14, paddingVertical: 13, marginTop: 18 },
  submitEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Detailed Modals Rich Elements
  detailHeroBox: { borderRadius: 20, padding: 18, alignItems: 'center', marginBottom: 14 },
  detailHeroIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  detailHeroTitle: { fontSize: 19, fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  detailBadgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 6 },
  detailCatPill: { fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  detailRatingPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#fef3c7' },

  detailStatusBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagOpen: { backgroundColor: '#dcfce7' },
  statusTagClosed: { backgroundColor: '#fee2e2' },
  statusTagText: { fontSize: 11, fontWeight: '800' },

  detailLocationBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 11,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailLocationText: { fontSize: 12.5, fontWeight: '700', color: '#334155', flex: 1, textAlign: 'right' },

  detailActionsGrid: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  detailActionBtnCall: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnCallText: { fontSize: 12, fontWeight: '800', color: '#0284c7' },
  detailActionBtnWa: {
    flex: 1.2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnWaText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  detailActionBtnMap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnMapText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  detailActionBtnShare: {
    flex: 0.8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnShareText: { fontSize: 12, fontWeight: '800', color: '#475569' },

  detailSectionBox: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  detailSectionTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 6 },
  detailSectionDesc: { fontSize: 13, color: '#475569', lineHeight: 20, textAlign: 'right' },
  detailServiceRow: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  detailReviewRow: { backgroundColor: '#fff', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },

  // Big RSVP button
  bigRsvpBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bigRsvpBtnActive: {
    backgroundColor: '#047857',
  },
  bigRsvpBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  // Product Preview Modal Elements
  productModalImgWrap: { width: '100%', height: 210, borderRadius: 18, overflow: 'hidden', marginBottom: 10, backgroundColor: '#f1f5f9' },
  productModalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', textAlign: 'right', flex: 1 },
  productModalPrice: { fontSize: 18, fontWeight: '900', color: '#059669' },
  productModalSub: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 4 },
  deliveryPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  deliveryPillText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  fullPageBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
  },
  fullPageBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
