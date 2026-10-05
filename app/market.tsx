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

type QuickFilter = 'all' | 'available' | 'delivery' | 'images';
const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'available', label: '🟢 متاح الآن' },
  { id: 'delivery', label: '🚗 توصيل' },
  { id: 'images', label: '📷 بالصور' },
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
    hours: 'مفتوح · حتى 12:00 ص',
    description: 'تموينات حي متكاملة، خضار وفواكه طازجة وتوصيل سريع لسكان الحي.',
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
    hours: 'مفتوح · حتى 11:30 م',
    description: 'غسيل وكي بالبخار، استلام وتسليم من المنازل مع خصم خاص لأهل الحي.',
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
    description: 'خبز طازج على مدار اليوم، فطائر صاج، ومعمول تمر فاخر بيتي.',
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
    hours: 'مفتوح · خدمة 24 ساعة',
    description: 'كافة الأدوية والمستلزمات الطبية مع استشارات صيدلانية مجانية.',
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
    description: 'قهوة مختصة وجلسات هادئة ملائمة لعمل الجيران ولقاءاتهم المجتمعية.',
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
    hours: 'مفتوح · استجابة سريعة',
    description: 'فنيون معتمدون لصيانة التكييف والمنازل مع ضمان للخدمات داخل الحي.',
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
    description: 'تصفيف وقص شعر وعناية باللحية بأدوات معقمة وطاقم محترف.',
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
    dateLabel: 'كل سبت · بعد صلاة المغرب',
    location: 'حديقة الحي المركزية',
    organizer: 'لجنة أهالي الحي',
    attendeesCount: 38,
    isFree: true,
    icon: '☕',
    color: '#d97706',
    bg: '#fffbeb',
    description: 'جلسة تعارف وتبادل الأفكار لتطوير خدمات الحي وقهوة ومخبوزات بدعم من أهل الحي.',
  },
  {
    id: 'ev-2',
    title: 'مبادرة تشجير ونظافة حديقة الحي 🌿',
    category: 'volunteer',
    categoryLabel: 'مبادرات وتطوع',
    city: 'الرياض',
    district: 'النرجس',
    dateLabel: 'الجمعة القادمة · 4:30 عصراً',
    location: 'ممشى وحديقة الحي',
    organizer: 'فريق متطوعي حيّنا',
    attendeesCount: 52,
    isFree: true,
    icon: '🌿',
    color: '#059669',
    bg: '#ecfdf5',
    description: 'زراعة 100 شتلة صديقة للبيئة وتجميل المرافق. الشتلات والأدوات موفرة مجاناً.',
  },
  {
    id: 'ev-3',
    title: 'دوري كرة القدم لشباب الحي ⚽',
    category: 'sports',
    categoryLabel: 'رياضية وشبابية',
    city: 'الرياض',
    district: 'الياسمين',
    dateLabel: 'مساء الخميس والجمعة · 8:00 م',
    location: 'ملاعب بلدية الحي',
    organizer: 'شباب الحي الرياضي',
    attendeesCount: 64,
    isFree: true,
    icon: '⚽',
    color: '#0284c7',
    bg: '#f0f9ff',
    description: 'بطولة كروية ودية لتعزيز الروح الرياضية والتعارف بين شباب حارات الحي مع كؤوس وميداليات.',
  },
  {
    id: 'ev-4',
    title: 'معرض الأسر المنتجة والحرف اليدوية 🛍️',
    category: 'family',
    categoryLabel: 'عائلية وأطفال',
    city: 'جدة',
    district: 'الروضة',
    dateLabel: 'نهاية الشهر (الخميس والجمعة) · 5:00 م',
    location: 'الساحة المجتمعية بالحي',
    organizer: 'أسر حيّنا المنتجة',
    attendeesCount: 95,
    isFree: true,
    icon: '🛍️',
    color: '#be185d',
    bg: '#fdf2f8',
    description: 'أكشاك للأطعمة المنزلية والحلويات والعبايات والمشغولات وركن ألعاب مخصص للأطفال.',
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
    description: 'دورة تطبيقية عملية للتعامل مع الحالات الطارئة للأطفال وكبار السن في المنزل.',
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

  // User Header & Location State
  const [profile, setProfile] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

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
          .select('*, profiles:provider_id(display_name, avatar_url, is_verified)')
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
        description: b.description || 'منشأة محلية تخدم سكان الحي.',
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
        description: ev.description || 'نشاط مجتمعي يجمع الجيران.',
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

  // Filtered Market Items
  const displayedMarket = inAreaMarket.filter(({ item, type }) => {
    if (activeType !== 'all' && type?.id !== activeType) return false;
    if (quick === 'available' && !item.available_now) return false;
    if (quick === 'delivery' && !(item.delivery_modes || []).includes('delivery')) return false;
    if (quick === 'images' && !getServiceCover(item)) return false;
    if (!query) return true;
    return [item.name, item.description, item.category, item.subcategory, item.shop_name, item.profiles?.display_name, item.district, type?.label]
      .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
  });

  const families = activeType === 'all' && quick === 'all' && !query
    ? inAreaMarket.filter((e) => e.type?.id === 'home_family').slice(0, 10)
    : [];

  // Filtered Businesses
  const displayedBusinesses = useMemo(() => {
    return businesses.filter((b) => {
      const matchLoc = isAllKingdom(activeLoc.city) || (b.city && b.city.includes(activeLoc.city));
      if (!matchLoc) return false;
      if (businessCategory !== 'all' && b.category !== businessCategory) return false;
      if (!query) return true;
      return [b.name, b.categoryLabel, b.description, b.district, b.city]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });
  }, [businesses, activeLoc, businessCategory, query]);

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
    const text = `شوف هذا العرض في حيّنا: ${item.name} — ${formatServicePrice(item)}`;
    try {
      await Share.share({
        message: Platform.OS === 'web' ? `${text} — ${window.location.origin}/service?id=${item.id}` : text,
        title: item.name,
      });
    } catch {}
  };

  const shareBusiness = async (b: any) => {
    const text = `دليل الأعمال بحيّنا: «${b.name}» (${b.categoryLabel}) في حي ${b.district || b.city}`;
    try {
      await Share.share({ message: text, title: b.name });
    } catch {}
  };

  const shareEvent = async (ev: any) => {
    const text = `دعوة لحضور «${ev.title}» بحيّنا!\n📍 المكان: ${ev.location}\n🗓️ الموعد: ${ev.dateLabel}`;
    try {
      await Share.share({ message: text, title: ev.title });
    } catch {}
  };

  const toggleRsvp = (eventId: string) => {
    setRsvpList((prev) => {
      const next = !prev[eventId];
      if (next) {
        Alert.alert('تم تسجيل حضورك! 🎉', 'يسعدنا تواجدك مع جيرانك في الفعالية.');
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

  const openItem = (id: string) => router.push({ pathname: '/service', params: { id } });

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

      const { data, error } = await supabase.from('events').insert(newEv).select().maybeSingle();

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

    return (
      <Pressable
        key={item.id}
        id={`market-item-${item.id}`}
        onPress={() => openItem(item.id)}
        style={({ pressed, hovered }: any) => [styles.card, { width: w }, hovered && styles.cardHover, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <View style={[styles.cardImage, { height: w * 0.78, backgroundColor: type?.bg || '#f1f5f9' }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : type ? (
            <type.Icon size={Math.min(40, w * 0.22)} color={type.color} strokeWidth={1.6} />
          ) : (
            <ShoppingBag size={36} color="#94a3b8" strokeWidth={1.6} />
          )}
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
          <View style={styles.cardTopActions}>
            <Pressable hitSlop={8} style={styles.shareFab} onPress={(e: any) => { e?.stopPropagation?.(); void shareItem(item); }}>
              <Send size={12} color="#334155" />
            </Pressable>
            {Boolean(item.whatsapp) && (
              <Pressable hitSlop={8} style={[styles.shareFab, { backgroundColor: '#25D366' }]} onPress={(e: any) => { e?.stopPropagation?.(); openWhatsApp(item.whatsapp, `مرحباً، شفت عرضك «${item.name}» في سوق الحي بحيّنا وحاب أستفسر`); }}>
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
            {item.profiles?.is_verified && <ShieldCheck size={11} color="#10b981" />}
            <MapPin size={10} color="#94a3b8" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {type?.nationwide ? 'عن بُعد' : (item.district || item.profiles?.district) ? `حي ${item.district || item.profiles?.district}` : (item.city || 'داخل الحي')}
            </Text>
            {Boolean(timeAgo) && <Text style={styles.cardTimeText}>· {timeAgo}</Text>}
          </View>
        </View>
      </Pressable>
    );
  };

  // Render Card: Local Business / Store Directory
  const renderBusinessCard = (b: any, w: number) => {
    return (
      <View
        key={b.id}
        style={[styles.card, { width: w }]}
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
            <Pressable hitSlop={8} style={styles.shareFab} onPress={() => shareBusiness(b)}>
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
              <Pressable style={styles.bizBtnCall} onPress={() => openPhone(b.phone)}>
                <Phone size={12} color="#0284c7" />
                <Text style={styles.bizBtnCallText}>اتصال</Text>
              </Pressable>
            )}
            {Boolean(b.whatsapp) && (
              <Pressable style={styles.bizBtnWa} onPress={() => openWhatsApp(b.whatsapp, `مرحباً «${b.name}»، شفت دليلكم في تطبيق حيّنا`)}>
                <MessageCircle size={12} color="#15803d" />
                <Text style={styles.bizBtnWaText}>واتساب</Text>
              </Pressable>
            )}
            <Pressable style={styles.bizBtnMap} onPress={() => openMaps(`${b.name} ${b.district || ''} ${b.city || ''}`)}>
              <Navigation size={12} color="#475569" />
              <Text style={styles.bizBtnMapText}>الخريطة</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  // Render Card: Neighborhood Community Event
  const renderEventCard = (ev: any, w: number) => {
    const isAttending = Boolean(rsvpList[ev.id]);
    const currentCount = ev.attendeesCount + (isAttending ? 1 : 0);

    return (
      <View
        key={ev.id}
        style={[styles.card, { width: w }]}
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
            <Pressable hitSlop={8} style={styles.shareFab} onPress={() => shareEvent(ev)}>
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
              onPress={() => toggleRsvp(ev.id)}
            >
              {isAttending ? <Check size={12} color="#fff" /> : <Sparkles size={12} color="#059669" />}
              <Text style={[styles.rsvpBtnText, isAttending && { color: '#fff' }]}>
                {isAttending ? 'سأحضر ✓' : 'حضور'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
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
        {/* Compact executive header */}
        <View style={styles.header}>
          <View style={styles.inner}>
            <View style={styles.topRow}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.headerTitle}>سوق وخدمات الحي</Text>
                <View style={styles.locRow}>
                  <MapPin size={12} color="#059669" />
                  <Text style={styles.locText} numberOfLines={1}>{locationLabel}</Text>
                  <ChevronDown size={12} color="#94a3b8" />
                </View>
              </View>
              <View style={styles.headerActions}>
                <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
                  <Bell size={19} color="#334155" />
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
          </View>
        </View>

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
              </Pressable>

              <Pressable
                onPress={() => setSection('businesses')}
                style={[styles.segmentBtn, section === 'businesses' && styles.segmentBtnActive]}
              >
                <Building2 size={14} color={section === 'businesses' ? '#fff' : '#64748b'} />
                <Text style={[styles.segmentText, section === 'businesses' && styles.segmentTextActive]}>دليل الأعمال والخدمات</Text>
              </Pressable>

              <Pressable
                onPress={() => setSection('events')}
                style={[styles.segmentBtn, section === 'events' && styles.segmentBtnActive]}
              >
                <Calendar size={14} color={section === 'events' ? '#fff' : '#64748b'} />
                <Text style={[styles.segmentText, section === 'events' && styles.segmentTextActive]}>فعاليات الحي</Text>
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
      {/* MODAL: ADD COMMUNITY EVENT                               */}
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

  header: { backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 52 : 18, paddingBottom: 10 },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2, maxWidth: 240 },
  locText: { fontSize: 12, color: '#475569', fontWeight: '700', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  notifBadgeText: { color: '#fff', fontSize: 8.5, fontWeight: '900' },
  avatarWrap: { width: 40, height: 40 },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#047857', fontSize: 16, fontWeight: '900' },
  avatarVerified: { position: 'absolute', right: -2, bottom: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

  stickyWrap: { backgroundColor: '#fff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

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
    gap: 6,
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

  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: '#f1f5f9', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  addBtn: { height: 46, minWidth: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#059669', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

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
    ...(Platform.OS === 'web' ? ({ transition: 'transform 160ms ease, box-shadow 160ms ease' } as any) : {}),
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

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0f172a', textAlign: 'right' },
  submitEventBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: 14, paddingVertical: 13, marginTop: 18 },
  submitEventBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
