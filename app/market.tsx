import { MarketPromotions } from '@/components/market/MarketPromotions';
import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, Image, RefreshControl, Share, useWindowDimensions, Linking, Modal, Alert, ImageBackground, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import ScreenState from '@/components/shared/ScreenState';
import AppHeader from '@/components/shared/AppHeader';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ShoppingBag, TrendingUp, SlidersHorizontal, Utensils, Pill, Shirt, Scissors, Wrench, Croissant, UsersRound, HeartHandshake, Trophy, Palette, House, Package, Image as ImageIcon, CircleCheck, ChevronDown,
  MapPin,
  ShieldCheck,
  Plus,
  Search,
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
  ArrowRight,
  ArrowUpDown,
  LayoutGrid,
  List,
  Send,
  CheckCircle2,
  Award,
  Truck,
  BadgeCheck,
  User,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export type SortOption = 'newest' | 'engaged' | 'nearby';
const SORT_OPTIONS: { id: SortOption; label: string; Icon: any }[] = [
  { id: 'newest', label: 'الأحدث', Icon: Clock },
  { id: 'engaged', label: 'الأكثر تفاعلاً', Icon: TrendingUp },
  { id: 'nearby', label: 'من حيّك أولاً', Icon: MapPin },
];

type QuickFilter = 'all' | 'available' | 'delivery' | 'images' | 'verified';
const QUICK_FILTERS: { id: QuickFilter; label: string; Icon?: any }[] = [
  { id: 'all', label: 'كل العروض', Icon: LayoutGrid },
  { id: 'available', label: 'متاح الآن', Icon: CircleCheck },
  { id: 'delivery', label: 'يتوفر توصيل', Icon: Truck },
  { id: 'images', label: 'عروض بالصور', Icon: ImageIcon },
  { id: 'verified', label: 'حساب موثق', Icon: ShieldCheck },
];

type BusinessCategory = 'all' | 'grocery' | 'restaurant' | 'pharmacy' | 'laundry' | 'salon' | 'repair' | 'bakery';
const BUSINESS_CATEGORIES: { id: BusinessCategory; label: string; Icon: any }[] = [
  { id: 'all', label: 'كل المحلات', Icon: Store },
  { id: 'grocery', label: 'بقالة وتموينات', Icon: ShoppingBag },
  { id: 'restaurant', label: 'مطاعم ومقاهي', Icon: Utensils },
  { id: 'pharmacy', label: 'صيدليات وعناية', Icon: Pill },
  { id: 'laundry', label: 'مغاسل وتنظيف', Icon: Shirt },
  { id: 'salon', label: 'حلاقة وصالونات', Icon: Scissors },
  { id: 'repair', label: 'صيانة وورش', Icon: Wrench },
  { id: 'bakery', label: 'مخابز وحلويات', Icon: Croissant },
];

type EventCategory = 'all' | 'community' | 'volunteer' | 'sports' | 'family' | 'culture';
const EVENT_CATEGORIES: { id: EventCategory; label: string; Icon: any }[] = [
  { id: 'all', label: 'كل الفعاليات', Icon: Calendar },
  { id: 'community', label: 'ملتقيات الجيران', Icon: UsersRound },
  { id: 'volunteer', label: 'مبادرات وتطوع', Icon: HeartHandshake },
  { id: 'sports', label: 'رياضية وشبابية', Icon: Trophy },
  { id: 'family', label: 'عائلية وأطفال', Icon: House },
  { id: 'culture', label: 'ثقافة ومجتمع', Icon: Palette },
];

export default function Market() {
  useTheme();
  const [marketScope, setMarketScope] = useState<'district' | 'city' | 'region'>('city');
  const [scopeLabel, setScopeLabel] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [catalogMore, setCatalogMore] = useState({ products:false, services:false, businesses:false, events:false });
  const catalogRequest = useRef(0), catalogPage = useRef(0), catalogLock = useRef(false);
  const bottomNavInset = useBottomNavInset();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Active Main Section: 'market' | 'businesses' | 'events'
  const params = useLocalSearchParams<{ section?: string; businessId?: string }>();
  const initialSection: MarketSection = params.section === 'events' ? 'events' : params.section === 'businesses' ? 'businesses' : 'market';
  const [section, setSection] = useState<MarketSection>(initialSection);

  // Core Market State (Real Database Only - No Mock Data)
  const [items, setItems] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [partialLoadError, setPartialLoadError] = useState(false);

  // Filters
  const [activeType, setActiveType] = useState<ListingTypeId | 'all'>('all');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('all');
  const [eventCategory, setEventCategory] = useState<EventCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterMenu, setFilterMenu] = useState<'sort' | 'category' | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [eventAttendees, setEventAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeActionBusy, setAttendeeActionBusy] = useState(false);
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});

  // Location State
  const [profile, setProfile] = useState<any>(null);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  // Selected Detail Modal States
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

  const favoriteKey = (targetType: 'service' | 'product' | 'store', itemId: string) => `${targetType}:${itemId}`;

  const toggleSaveItem = async (itemId: string, targetType: 'service' | 'product' | 'store') => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      Alert.alert('سجّل الدخول أولاً', 'يلزم تسجيل الدخول لحفظ المنتجات والمتاجر في المفضلة.');
      router.push('/auth');
      return;
    }
    const key = favoriteKey(targetType, itemId);
    const isSaved = Boolean(savedItems[key]);
    setSavedItems((prev) => ({ ...prev, [key]: !isSaved }));
    try {
      if (isSaved) {
        const { error } = await supabase.from('favorite_items').delete()
          .eq('user_id', auth.user.id).eq('target_type', targetType).eq('target_id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorite_items').upsert(
          { user_id: auth.user.id, target_type: targetType, target_id: itemId },
          { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      }
    } catch (error: any) {
      setSavedItems((prev) => ({ ...prev, [key]: isSaved }));
      Alert.alert('تعذر تحديث المفضلة', error?.message || 'حاول مرة أخرى بعد قليل.');
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: favorites } = await supabase.from('favorite_items')
        .select('target_type,target_id').eq('user_id', u.user.id)
        .in('target_type', ['service', 'product', 'store']);
      if (favorites) {
        setSavedItems(Object.fromEntries(favorites.map((fav: any) => [favoriteKey(fav.target_type, fav.target_id), true])));
      }
      const { data: p } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, is_geoverified, account_type, is_verified, freelance_trade, city, district, region')
        .eq('id', u.user.id)
        .maybeSingle();
      setProfile(p);
    };
    void loadUser();
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    return unsub;
  }, []);

  useEffect(() => {
    void loadAllData();
    return () => { catalogRequest.current++; };
  }, [marketScope, activeLoc.city, activeLoc.district, activeLoc.region]);

  useEffect(() => {
    if (!params.businessId || !businesses.length) return;
    const savedBusiness = businesses.find((business) => business.id === params.businessId);
    if (savedBusiness) {
      setSection('businesses');
      setSelectedBusiness(savedBusiness);
    }
  }, [params.businessId, businesses]);

  const loadAllData = async (append = false) => {
    if (append && catalogLock.current) return;
    const ticket = append ? catalogRequest.current : ++catalogRequest.current;
    const nextPage = append ? catalogPage.current + 1 : 0;
    catalogLock.current = true;
    if (!append) { setLoading(true); setItems([]); setBusinesses([]); setEvents([]); setScopeError(''); }
    setRefreshing(true);
    setLoadError(false);
    setPartialLoadError(false);
    try {
      const read = async (source: string) => {
        const result = await supabase.rpc('hayna_market_catalog_page', { p_source: source, p_scope: marketScope, p_page: nextPage });
        return { ...result, data: result.data?.rows || [], meta: result.data };
      };
      const [servicesRes, productsRes, businessRes, eventsRes] = await Promise.all([
        read('services'), read('products'), read('businesses'), read('events'),
      ]);
      if (ticket !== catalogRequest.current) return;
      const scoped = [servicesRes, productsRes, businessRes, eventsRes].find(result => !result.error)?.meta;
      if (scoped?.label) setScopeLabel(scoped.label);
      setCatalogMore({ products:!!productsRes.meta?.has_more, services:!!servicesRes.meta?.has_more, businesses:!!businessRes.meta?.has_more, events:!!eventsRes.meta?.has_more });
      const scopeFailure = [servicesRes, productsRes, businessRes, eventsRes].find(result => result.error)?.error?.message || '';
      if (/account_.*required|account_region_mismatch/.test(scopeFailure)) setScopeError('أكمل مدينة وحي ومنطقة حسابك لعرض نتائج نطاقك فقط.');
      if (/authentication_required/.test(scopeFailure)) setScopeError('سجّل الدخول لعرض السوق حسب موقع حسابك.');
      catalogPage.current = nextPage;
      const failedSources = [servicesRes, productsRes, businessRes, eventsRes].filter(result => result.error).length;
      if (failedSources === 4) throw new Error('market_sources_unavailable');
      setPartialLoadError(failedSources > 0);

      const serviceRows = servicesRes.error
        ? []
        : (servicesRes.data || []).map((row: any) => ({ ...row, _source: 'service' }));

      const productRows = productsRes.error
        ? []
        : (productsRes.data || []).map((row: any) => ({
            ...row,
            _source: 'product',
            name: row.title,
            price_from: row.price,
            price_to: null,
            price_type: row.price == null ? 'negotiable' : 'fixed',
            listing_type: row.business_id ? 'product_in_shop' : 'home_sale',
            subcategory: row.item_type,
            shop_name: row.business?.name || null,
            cover_url: row.image_url,
            images: row.image_url ? [row.image_url] : [],
            available_now: row.status === 'available',
            delivery_modes: [],
            whatsapp: null,
            phone: null,
            profiles: row.seller || null,
          }));

      setItems(previous =>
        [...(append ? previous : []), ...serviceRows, ...productRows].filter((row, index, all) => all.findIndex(other => other.id === row.id && other._source === row._source) === index).sort(
          (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        ),
      );

      // Map real businesses only (No mock data)
      const dbBusinesses = (businessRes.data || []).map((b: any) => ({
        id: b.id,
        name: b.name || 'منشأة تجارية',
        category: b.category || 'all',
        image_url: b.image_url || b.cover_url || b.logo_url || null,
        cover_url: b.cover_url || b.image_url || null,
        logo_url: b.logo_url || null,
        categoryLabel: BUSINESS_CATEGORIES.find((c) => c.id === b.category)?.label || b.category || 'خدمات محلية',
        city: b.city || '',
        district: b.district || '',
        rating: b.reviews_count > 0 && b.rating != null ? Number(b.rating) : null,
        reviews: b.reviews_count || 0,
        phone: b.phone || '',
        whatsapp: b.whatsapp || '',
        openNow: typeof b.is_open === 'boolean' ? b.is_open : null,
        created_at: b.created_at,
        is_verified: Boolean(b.is_verified),
        Icon: BUSINESS_CATEGORIES.find((c) => c.id === b.category)?.Icon || Store,
        color: OASIS.colors.primary,
        bg: OASIS.colors.soft,
        hours: b.working_hours || 'ساعات العمل حسب التنسيق',
        description: b.description || 'تعرّف على تفاصيل المنشأة وطرق التواصل معها.',
        features: b.features || [],
        servicesList: b.services_list || [],
        reviewsList: b.reviews_list || [],
      }));
      setBusinesses(previous => append ? [...previous, ...dbBusinesses].filter((row, index, all) => all.findIndex(other => other.id === row.id) === index) : dbBusinesses);

      // Map real events only (No mock data)
      const dbEvents = (eventsRes.data || []).map((ev: any) => ({
        id: ev.id,
        title: ev.title || 'فعالية الحي',
        category: ev.category || 'community',
        categoryLabel: EVENT_CATEGORIES.find((c) => c.id === ev.category)?.label || ev.category || 'أنشطة الحي',
        city: ev.city || '',
        district: ev.district || '',
        dateLabel: ev.date_label || (ev.starts_at ? new Date(ev.starts_at).toLocaleString('ar-SA') : 'قريباً'),
        location: ev.location_name || 'نقطة التجمع بالحي',
        organizer: ev.organizer?.display_name || 'أحد سكان الحي',
        organizerId: ev.organizer_id,
        attendeesCount: ev.attendees_count || 0,
        isFree: ev.is_free ?? true,
        Icon: EVENT_CATEGORIES.find((c) => c.id === ev.category)?.Icon || Calendar,
        color: OASIS.colors.primary,
        bg: OASIS.colors.soft,
        description: ev.description || 'نشاط مجتمعي يجمع الجيران في أجواء طيبة ومميزة.',
        agenda: ev.agenda || [],
        guidelines: ev.guidelines || '',
      }));
      setEvents(previous => append ? [...previous, ...dbEvents].filter((row, index, all) => all.findIndex(other => other.id === row.id) === index) : dbEvents);
    } catch {
      if (ticket === catalogRequest.current) setLoadError(true);
    } finally {
      if (ticket === catalogRequest.current) { setLoading(false); setRefreshing(false); catalogLock.current = false; }
    }
  };

  // Market listings resolved with listing type + location match
  const enrichedMarket = useMemo(() => items.map((item) => {
    const type = getListingType(item.listing_type, item.category);
    const locItem = {
      city: item.city || item.profiles?.city || null,
      district: item.district || item.profiles?.district || null,
    };
    const inArea = true; // Scope is enforced by hayna_market_catalog_page before pagination.
    return { item, type, inArea };
  }), [items, activeLoc]);

  const inAreaMarket = enrichedMarket.filter((e) => e.inArea);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inAreaMarket.forEach((e) => {
      if (e.type) counts[e.type.id] = (counts[e.type.id] || 0) + 1;
    });
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
      if (quick === 'verified' && !item.is_verified && !item.business?.is_verified) return false;
      if (!query) return true;
      return [
        item.name,
        item.description,
        item.category,
        item.subcategory,
        item.shop_name,
        item.profiles?.display_name,
        item.district,
        type?.label,
      ].some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'engaged') {
        const score = (x: any) => Number(x.views_count ?? x.views ?? 0) + Number(x.likes_count ?? x.likes ?? 0) * 2 + Number(x.favorites_count ?? 0) * 3;
        return score(b.item) - score(a.item) || new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
      }
      if (sortBy === 'nearby') {
        const rank = (x: any) => {
          const city = x.item.city || x.item.profiles?.city;
          const district = x.item.district || x.item.profiles?.district;
          return district && district === activeLoc.district ? 0 : city && city === activeLoc.city ? 1 : 2;
        };
        return rank(a) - rank(b) || new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
      }
      return new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime();
    });
  }, [inAreaMarket, activeType, quick, query, sortBy, activeLoc]);

  const families = activeType === 'all' && quick === 'all' && !query
    ? inAreaMarket.filter((e) => e.type?.id === 'home_family').slice(0, 10)
    : [];

  // Filtered & Sorted Businesses
  const displayedBusinesses = useMemo(() => {
    const filtered = businesses.filter((b) => {
      if (businessCategory !== 'all' && b.category !== businessCategory) return false;
      if (quick === 'available' && !b.openNow) return false;
      if (quick === 'verified' && !b.is_verified) return false;
      if (!query) return true;
      return [b.name, b.categoryLabel, b.description, b.district, b.city]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'engaged') return (b.reviews || 0) - (a.reviews || 0) || (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'nearby') {
        const rank = (x: any) => x.district && x.district === activeLoc.district ? 0 : x.city && x.city === activeLoc.city ? 1 : 2;
        return rank(a) - rank(b) || (b.reviews || 0) - (a.reviews || 0);
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [businesses, activeLoc, businessCategory, quick, query, sortBy]);

  // Filtered Events
  const displayedEvents = useMemo(() => {
    return events.filter((ev) => {
      if (eventCategory !== 'all' && ev.category !== eventCategory) return false;
      if (!query) return true;
      return [ev.title, ev.categoryLabel, ev.description, ev.location, ev.organizer]
        .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
    });
  }, [events, activeLoc, eventCategory, query]);

  const shareItem = async (item: any) => {
    const text = `شوف هذا العرض في سوق حيّنا: ${item.name} — ${formatServicePrice(item)}`;
    const route = item._source === 'product' ? 'marketplace-item' : 'service';
    try {
      await Share.share({
        message: Platform.OS === 'web' && typeof window !== 'undefined' ? `${text} — ${window.location.origin}/${route}?id=${item.id}` : text,
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
    const text = `دعوة لحضور «${ev.title}» بحيّنا!\nالمكان: ${ev.location}\nالموعد: ${ev.dateLabel}\nالدعوة عامة والدخول مجاني`;
    try {
      await Share.share({ message: text, title: ev.title });
    } catch {}
  };

  const toggleRsvp = async (eventId: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) { router.push('/auth'); return; }
    const attending = Boolean(rsvpList[eventId]);
    setAttendeeActionBusy(true);
    try {
      if (attending) {
        const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_attendees').upsert({ event_id: eventId, user_id: userId, status: 'going' }, { onConflict: 'event_id,user_id' });
        if (error) throw error;
      }
      setRsvpList((prev) => ({ ...prev, [eventId]: !attending }));
      setEvents((prev) => prev.map((ev) => ev.id === eventId ? { ...ev, attendeesCount: Math.max(0, (ev.attendeesCount || 0) + (attending ? -1 : 1)) } : ev));
      if (!attending) Alert.alert('تم تسجيل حضورك', 'تم تسجيل مشاركتك في الفعالية.');
      if (selectedEvent?.id === eventId) setSelectedEvent((prev: any) => prev ? { ...prev, attendeesCount: Math.max(0, (prev.attendeesCount || 0) + (attending ? -1 : 1)) } : prev);
    } catch (error: any) {
      Alert.alert('تعذر تحديث الحضور', error?.message || 'حاول مرة أخرى بعد قليل.');
    } finally { setAttendeeActionBusy(false); }
  };

  useEffect(() => {
    const loadRsvpAndAttendees = async () => {
      if (!selectedEvent) { setEventAttendees([]); return; }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (userId) {
        const { data: mine } = await supabase.from('event_attendees').select('event_id,status').eq('event_id', selectedEvent.id).eq('user_id', userId).maybeSingle();
        setRsvpList((prev) => ({ ...prev, [selectedEvent.id]: Boolean(mine && mine.status !== 'cancelled') }));
      }
      if (userId && selectedEvent.organizerId === userId) {
        setLoadingAttendees(true);
        const { data, error } = await supabase.from('event_attendees')
          .select('user_id,status,created_at,profile:profiles!event_attendees_user_id_fkey(display_name,username,avatar_url)')
          .eq('event_id', selectedEvent.id).eq('status', 'going').order('created_at', { ascending: false });
        if (!error) setEventAttendees(data || []);
        setLoadingAttendees(false);
      } else setEventAttendees([]);
    };
    void loadRsvpAndAttendees();
  }, [selectedEvent?.id, selectedEvent?.organizerId]);

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
    if (item._source === 'product') {
      router.push({ pathname: '/marketplace-item', params: { id: item.id } });
      return;
    }
    router.push({ pathname: '/service', params: { id: item.id } });
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
        location_name: eventLocation.trim(),
        date_label: eventDate.trim() || 'قريباً',
        category: eventCategoryChoice,
        city: isAllKingdom(activeLoc.city) ? 'الرياض' : activeLoc.city,
        district: activeLoc.district !== 'كل الأحياء' ? activeLoc.district : 'الحي',
        organizer_id: profile?.id || null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('events').insert({ ...newEv, moderation_status: 'pending' });
      if (error) throw error;
      setShowEventModal(false);
      setEventTitle('');
      setEventDesc('');
      setEventLocation('');
      setEventDate('');
      Alert.alert('تم استلام الفعالية للمراجعة', 'ستظهر في سوق الحي بعد اعتمادها من الإدارة.');
    } catch (error: any) {
      Alert.alert('تعذر إرسال الفعالية', error?.message || 'تحقق من الاتصال ثم حاول مرة أخرى.');
    } finally {
      setSavingEvent(false);
    }
  };

  // Render Card: Market Product / Service
  const renderMarketCard = ({ item, type }: { item: any; type: ReturnType<typeof getListingType> }, w: number, listMode = false) => {
    const cover = getServiceCover(item);
    const modes: string[] = (item.delivery_modes || []).slice(0, 3);
    const timeAgo = relativeTime(item.created_at);
    const favoriteType = item._source === 'product' ? 'product' : 'service';
    const isSaved = Boolean(savedItems[favoriteKey(favoriteType, item.id)]);

    return (
      <Pressable oasisKind="card" accessibilityRole="none" focusable={false}
        key={item.id}
        id={`market-item-${item.id}`}
        onPress={() => openItem(item)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          listMode && styles.cardRow,
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={[styles.cardImage, listMode ? styles.cardImageRow : { height: w * 0.78 }, { backgroundColor: type?.bg || '#f1f5f9' }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : type ? (
            <type.Icon size={Math.min(38, w * 0.22)} color={type.color} strokeWidth={1.8} />
          ) : (
            <ShoppingBag size={34} color="#94a3b8" strokeWidth={1.8} />
          )}

          {/* Top Badges */}
          {type && (
            <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.96)' }]}>
              <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.short}</Text>
            </View>
          )}

          {item.available_now && (
            <View style={styles.availableBadgePill}>
              <View style={styles.availableDot} />
              <Text style={styles.availableBadgeText}>متاح</Text>
            </View>
          )}

          {/* Action FABs */}
          <View style={styles.cardTopActions}>
            <Pressable
              hitSlop={8}
              style={[styles.shareFab, isSaved && { backgroundColor: OASIS.colors.dangerSoft }]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void toggleSaveItem(item.id, favoriteType);
              }}
            >
              <Heart size={13} color={isSaved ? OASIS.colors.danger : OASIS.colors.muted} fill={isSaved ? OASIS.colors.danger : 'none'} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.shareFab}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void shareItem(item);
              }}
            >
              <Send size={12} color={OASIS.colors.ink} />
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
                <MessageCircle size={13} color={OASIS.colors.surface} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.cardBody, listMode && styles.cardBodyRow]}>
          <Text style={styles.cardTitle} numberOfLines={listMode ? 2 : 1}>{item.name}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.shop_name ? item.shop_name : (item.subcategory || item.profiles?.display_name || item.category || 'عرض محلي')}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardPrice} numberOfLines={1}>{formatServicePrice(item)}</Text>
            {modes.length > 0 && (
              <View style={styles.cardModes}>
                {modes.map((m) => {
                  const mode = getDeliveryMode(m);
                  if (!mode) return null;
                  const ModeIcon = m === 'delivery' ? Truck
                    : m === 'pickup_home' ? House
                    : m === 'at_shop' ? Store
                    : m === 'home_visit' ? Wrench
                    : ExternalLink;
                  return (
                    <View key={m} style={styles.cardModeIcon} accessibilityLabel={mode.label}>
                      <ModeIcon size={13} color={OASIS.colors.muted} strokeWidth={2.1} />
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.cardMeta}>
            {item.profiles?.is_verified && <ShieldCheck size={12} color={OASIS.colors.primary} />}
            <MapPin size={10} color="#94a3b8" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {type?.nationwide ? 'عن بُعد' : (item.district || item.profiles?.district) ? `حي ${item.district || item.profiles?.district}` : (item.city || 'داخل الحي')}
            </Text>
            {listMode && Boolean(timeAgo) && <Text style={styles.cardTimeText} numberOfLines={1}>· {timeAgo}</Text>}
          </View>
          {!listMode && Boolean(timeAgo) && <Text style={[styles.cardTimeText,{textAlign:'right',marginTop:4}]} numberOfLines={1}>{timeAgo}</Text>}

          <Pressable accessibilityRole="button" accessibilityLabel={`عرض تفاصيل ${item.name}`} onPress={(event:any) => { event?.stopPropagation?.(); openItem(item); }} style={styles.cardDetailsHintRow}>
            <Text style={styles.cardDetailsHintText}>عرض التفاصيل الكاملة</Text>
            <ArrowRight size={11} color={OASIS.colors.primary} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  // Render Card: Local Business / Store Directory
  const renderBusinessCard = (b: any, w: number, listMode = false) => {
    const isSaved = Boolean(savedItems[favoriteKey('store', b.id)]);

    return (
      <Pressable oasisKind="card" accessibilityRole="none" focusable={false}
        key={b.id}
        onPress={() => setSelectedBusiness(b)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          listMode && styles.cardRow,
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={[styles.cardImage, listMode ? styles.cardImageRow : { height: w * 0.58 }, { backgroundColor: b.bg || OASIS.colors.infoSoft }]}>
          <Text style={{ fontSize: Math.min(36, w * 0.22) }}><b.Icon size={34} color={b.color || OASIS.colors.info} /></Text>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.96)' }]}>
            <Text style={[styles.typeBadgeText, { color: b.color || OASIS.colors.info }]}>{b.categoryLabel}</Text>
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
              style={[styles.shareFab, isSaved && { backgroundColor: OASIS.colors.dangerSoft }]}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void toggleSaveItem(b.id, 'store');
              }}
            >
              <Heart size={13} color={isSaved ? OASIS.colors.danger : OASIS.colors.muted} fill={isSaved ? OASIS.colors.danger : 'none'} />
            </Pressable>
            <Pressable
              hitSlop={8}
              style={styles.shareFab}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                void shareBusiness(b);
              }}
            >
              <Share2 size={12} color={OASIS.colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.cardBody, listMode && styles.cardBodyRow]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{b.name}</Text>
              {b.is_verified && <ShieldCheck size={13} color={OASIS.colors.primary} />}
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
              <Star size={11} color={OASIS.colors.warning} fill={OASIS.colors.warning} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: OASIS.colors.ink }}>{b.rating == null ? 'جديد' : b.rating.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.cardSub} numberOfLines={2}>{b.description || b.hours}</Text>

          <View style={[styles.cardMeta, { marginTop: 6 }]}>
            <MapPin size={10} color={OASIS.colors.primary} />
            <Text style={[styles.cardMetaText, { color: OASIS.colors.muted }]} numberOfLines={1}>
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
                <Phone size={12} color={OASIS.colors.info} />
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
              <Navigation size={12} color={OASIS.colors.muted} />
              <Text style={styles.bizBtnMapText}>الخريطة</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel={`عرض تفاصيل ${b.name}`} onPress={(event:any) => { event?.stopPropagation?.(); setSelectedBusiness(b); }} style={styles.cardDetailsHintRow}>
            <Text style={[styles.cardDetailsHintText, { color: OASIS.colors.info }]}>عرض بطاقة المحل والخدمات</Text>
            <ArrowRight size={11} color={OASIS.colors.info} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  // Render Card: Neighborhood Community Event
  const renderEventCard = (ev: any, w: number, listMode = false) => {
    const isAttending = Boolean(rsvpList[ev.id]);
    const currentCount = ev.attendeesCount + (isAttending ? 1 : 0);

    return (
      <Pressable oasisKind="card" accessibilityRole="none" focusable={false}
        key={ev.id}
        onPress={() => setSelectedEvent(ev)}
        style={({ pressed, hovered }: any) => [
          styles.card,
          { width: w },
          listMode && styles.cardRow,
          hovered && styles.cardHover,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={[styles.cardImage, listMode ? styles.cardImageRow : { height: w * 0.58 }, { backgroundColor: ev.bg || OASIS.colors.soft }]}>
          <Text style={{ fontSize: Math.min(36, w * 0.22) }}><ev.Icon size={34} color={ev.color || OASIS.colors.primary} /></Text>
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(255,255,255,0.96)' }]}>
            <Text style={[styles.typeBadgeText, { color: ev.color || OASIS.colors.primary }]}>{ev.categoryLabel}</Text>
          </View>
          <View style={[styles.availableBadgePill, { backgroundColor: OASIS.colors.soft, borderColor: '#a7f3d0' }]}>
            <Text style={[styles.availableBadgeText, { color: OASIS.colors.primary }]}>{ev.isFree ? 'مجاني' : 'تسجيل'}</Text>
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
              <Share2 size={12} color={OASIS.colors.ink} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.cardBody, listMode && styles.cardBodyRow]}>
          <Text style={styles.cardTitle} numberOfLines={listMode ? 2 : 1}>{ev.title}</Text>
          <Text style={styles.cardSub} numberOfLines={2}>{ev.description}</Text>

          <View style={styles.eventInfoBox}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Clock size={11} color="#d97706" />
              <Text style={styles.eventInfoText} numberOfLines={1}>{ev.dateLabel}</Text>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <MapPin size={11} color={OASIS.colors.primary} />
              <Text style={styles.eventInfoText} numberOfLines={1}>{ev.location}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Users size={12} color={OASIS.colors.muted} />
              <Text style={{ fontSize: 11, color: OASIS.colors.muted, fontWeight: '700' }}>
                {currentCount} مشارك
              </Text>
            </View>

            <Pressable oasisKind="action"
              style={[styles.rsvpBtn, isAttending && styles.rsvpBtnActive, attendeeActionBusy && { opacity: 0.65 }]}
              disabled={attendeeActionBusy}
              onPress={(e: any) => {
                e?.stopPropagation?.();
                toggleRsvp(ev.id);
              }}
            >
              {isAttending ? <Check size={12} color={OASIS.colors.surface} /> : <Sparkles size={12} color={OASIS.colors.primary} />}
              <Text style={[styles.rsvpBtnText, isAttending && { color: OASIS.colors.surface }]}>
                {isAttending ? 'سأحضر ✓' : 'حضور'}
              </Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel={`عرض تفاصيل ${ev.title}`} onPress={(event:any) => { event?.stopPropagation?.(); setSelectedEvent(ev); }} style={styles.cardDetailsHintRow}>
            <Text style={[styles.cardDetailsHintText, { color: OASIS.colors.primary }]}>عرض تفاصيل الفعالية والبرنامج</Text>
            <ArrowRight size={11} color={OASIS.colors.primary} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const locationLabel = scopeLabel || 'نطاق موقع حسابك';

  // Add Button Action based on current section
  const handleAddPress = () => {
    if (section === 'market') {
      router.push('/new-listing');
    } else if (section === 'businesses') {
      router.push({ pathname: '/profile', params: { tab: 'content' } });
    } else {
      setShowEventModal(true);
    }
  };

  const addBtnLabel = section === 'market' ? 'إضافة منتج أو خدمة' : section === 'businesses' ? 'إدارة منشأتي' : 'أضف فعالية';
  const hasFilters = Boolean(searchQuery.trim() || activeType !== 'all' || quick !== 'all' || businessCategory !== 'all' || eventCategory !== 'all');
  const resetMarketFilters = () => {
    setSearchQuery(''); setActiveType('all'); setQuick('all'); setBusinessCategory('all'); setEventCategory('all');
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader variant="tab" title="السوق" subtitle={locationLabel} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 28 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAllData} tintColor={OASIS.colors.primary} />}
      >
        {/* ======================================================== */}
        {/* HERO EXECUTIVE CARD                                      */}
        {/* ======================================================== */}
        <View style={styles.heroSectionWrap}>
          <View style={styles.inner}>
            <LinearGradient
              colors={['#123f34', '#176650', '#237a5b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.heroBadgeRow}>
                    <View style={styles.heroLocBadge}>
                      <MapPin size={10} color="#a7f3d0" />
                      <Text style={styles.heroLocText} numberOfLines={1}>{locationLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.heroTitle}>سوق الحي</Text>
                  <Text style={styles.heroSubtitle}>عروض الجيران، دليل المحلات، وفعاليات الحي في مكان واحد.</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="لوحة إدارة السوق" onPress={() => router.push('/marketplace-dashboard')} style={styles.workspaceShortcut}>
                  <Store size={20} color="#ffffff" />
                  <Text style={styles.workspaceShortcutText}>لوحتي</Text>
                </Pressable>
              </View>

            </LinearGradient>
          </View>
        </View>

        {/* ======================================================== */}
        {/* STICKY INTERACTIVE CONTROLS BAR                          */}
        {/* ======================================================== */}
        <View style={styles.stickyWrap}>
          <View style={styles.inner}>
            {/* Primary Segment Switcher */}
            <View style={styles.segmentWrap}>
              <Pressable oasisVariant={section === 'market' ? 'primary' : 'secondary'} oasisKind="chip"
                onPress={() => setSection('market')}
                style={[styles.segmentBtn, section === 'market' && styles.segmentBtnActive]}
              >
                <ShoppingBag size={14} color={section === 'market' ? OASIS.colors.surface : OASIS.colors.muted} />
                <Text style={[styles.segmentText, section === 'market' && styles.segmentTextActive]}>العروض</Text>
                <View style={[styles.segmentCount, section === 'market' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'market' && styles.segmentCountTextActive]}>
                    {inAreaMarket.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable oasisVariant={section === 'businesses' ? 'primary' : 'secondary'} oasisKind="chip"
                onPress={() => setSection('businesses')}
                style={[styles.segmentBtn, section === 'businesses' && styles.segmentBtnActive]}
              >
                <Building2 size={14} color={section === 'businesses' ? OASIS.colors.surface : OASIS.colors.muted} />
                <Text style={[styles.segmentText, section === 'businesses' && styles.segmentTextActive]}>المحلات</Text>
                <View style={[styles.segmentCount, section === 'businesses' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'businesses' && styles.segmentCountTextActive]}>
                    {displayedBusinesses.length}
                  </Text>
                </View>
              </Pressable>

              <Pressable oasisVariant={section === 'events' ? 'primary' : 'secondary'} oasisKind="chip"
                onPress={() => setSection('events')}
                style={[styles.segmentBtn, section === 'events' && styles.segmentBtnActive]}
              >
                <Calendar size={14} color={section === 'events' ? OASIS.colors.surface : OASIS.colors.muted} />
                <Text style={[styles.segmentText, section === 'events' && styles.segmentTextActive]}>الفعاليات</Text>
                <View style={[styles.segmentCount, section === 'events' && styles.segmentCountActive]}>
                  <Text style={[styles.segmentCountText, section === 'events' && styles.segmentCountTextActive]}>
                    {displayedEvents.length}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Contextual Search Input & Action Button */}
            <View style={styles.searchRow}>
              <OasisSurface oasisSurface="field" style={styles.searchBox}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  id="market-search"
                  accessibilityLabel="البحث في السوق"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={
                    section === 'market'
                      ? 'ابحث عن منتج أو خدمة...'
                      : section === 'businesses'
                      ? 'ابحث عن بقالة، صيدلية، مطعم، ورشة...'
                      : 'ابحث في فعاليات وملتقيات الحي...'
                  }
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  textAlign="right"
                />
                {!!searchQuery && (
                  <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" hitSlop={10} onPress={() => setSearchQuery('')}>
                    <X size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </OasisSurface>

              <Pressable oasisKind="action" id="market-add" accessibilityRole="button" accessibilityLabel={addBtnLabel} style={styles.addBtn} onPress={handleAddPress}>

                <Plus size={18} color={OASIS.colors.surface} />
                <Text style={styles.addBtnText}>{width < 500 ? 'إضافة' : addBtnLabel}</Text>
              </Pressable>
            </View>

            <OasisSurface oasisSurface="card" style={styles.scopePanel}>
              <View style={{flexDirection:'row-reverse',alignItems:'center',gap:7}}><MapPin size={17} color={OASIS.colors.primary}/><Text style={{color:OASIS.colors.ink,fontWeight:'700',fontSize:13}}>نطاق السوق</Text></View>
              <View style={{flexDirection:'row-reverse',gap:6}}>
                {([{id:'district',label:'حيّي'},{id:'city',label:'مدينتي كاملة'},{id:'region',label:'منطقتي'}] as const).map(option=><Pressable key={option.id} accessibilityRole="button" accessibilityState={{selected:marketScope===option.id}} onPress={()=>setMarketScope(option.id)} style={[styles.scopeOption,{backgroundColor:marketScope===option.id?OASIS.colors.primary:OASIS.colors.soft}]}><Text style={{fontSize:12,fontWeight:'700',color:marketScope===option.id?'#fff':OASIS.colors.muted}}>{option.label}</Text></Pressable>)}
              </View>
              <Text style={{color:OASIS.colors.muted,fontSize:11,textAlign:'right'}}>من موقع حسابك فقط · {locationLabel}</Text>
              {!!scopeError&&<><Text accessibilityRole="alert" style={{color:OASIS.colors.danger,textAlign:'right',fontSize:12}}>{scopeError}</Text><Pressable onPress={()=>router.push(profile?'/locations':'/auth')}><Text style={{color:OASIS.colors.primary,textAlign:'right',fontWeight:'700'}}>مراجعة الحساب والموقع</Text></Pressable></>}
            </OasisSurface>
            <View style={styles.filterControlsRow}>
              <Pressable style={styles.filterSelect} onPress={() => setFilterMenu('sort')}>
                <ArrowUpDown size={15} color={OASIS.colors.muted} /><Text style={styles.filterSelectLabel}>الترتيب</Text>
                <Text style={styles.filterSelectValue}>{SORT_OPTIONS.find((o) => o.id === sortBy)?.label || 'الأحدث'}</Text><ChevronDown size={15} color={OASIS.colors.muted} />
              </Pressable>
              <Pressable style={styles.filterSelect} onPress={() => setFilterMenu('category')}>
                <SlidersHorizontal size={15} color={OASIS.colors.muted} /><Text style={styles.filterSelectLabel}>التصفية</Text>
                <Text style={styles.filterSelectValue} numberOfLines={1}>{section === 'market' ? (activeType === 'all' ? QUICK_FILTERS.find((f) => f.id === quick)?.label || 'كل العروض' : LISTING_TYPES.find((t) => t.id === activeType)?.short || 'كل العروض') : section === 'businesses' ? (BUSINESS_CATEGORIES.find((c) => c.id === businessCategory)?.label || 'كل المحلات') : (EVENT_CATEGORIES.find((c) => c.id === eventCategory)?.label || 'كل الفعاليات')}</Text>
                <ChevronDown size={15} color={OASIS.colors.muted} />
              </Pressable>
            </View>
            {section === 'market' && (
              <ScrollView horizontal {...(Platform.OS === 'web' ? {dir:'rtl'} : {})} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryChips}>
                {QUICK_FILTERS.map(({id,label,Icon}) => (
                  <Pressable key={id} accessibilityRole="button" accessibilityState={{selected:quick===id}} onPress={() => setQuick(id)} style={[styles.discoveryChip,quick===id && styles.discoveryChipActive]}>
                    {Icon && <Icon size={14} color={quick===id ? OASIS.colors.primary : OASIS.colors.muted}/>}
                    <Text style={[styles.discoveryChipText,quick===id && {color:OASIS.colors.primary}]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {hasFilters && <View style={styles.browseToolbar}>
              <Text style={styles.browseCaption}>{hasFilters ? 'نتائج حسب اختياراتك' : 'اكتشف ما يقدمه أهل الحي'}</Text>
              <View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}>
                {hasFilters && <Pressable accessibilityRole="button" onPress={resetMarketFilters} style={styles.clearFilters}><X size={13} color={OASIS.colors.primary}/><Text style={styles.clearFiltersText}>مسح الفلاتر</Text></Pressable>}
              </View>
            </View>}
          </View>
        </View>

        {/* ======================================================== */}
        {/* MAIN BODY CONTENT                                        */}
        {/* ======================================================== */}
        <View style={styles.inner}>
          {partialLoadError && !loading && !loadError && <Pressable accessibilityRole="button" onPress={()=>void loadAllData()} style={styles.partialNotice}><Text style={styles.partialNoticeText}>تعذر تحميل بعض الأقسام. اضغط لإعادة المحاولة.</Text></Pressable>}
          {loading ? (
            <ScreenState type="loading" title="جاري التجهيز والتحميل" message="نرتب لك محتوى الحي الأقرب إليك" />
          ) : loadError ? (
            <View style={{ paddingVertical: 16 }}>
              <ScreenState type="error" title="تعذر تحميل المحتوى" message="اسحب للتحديث وحاول مرة أخرى" />
            </View>
          ) : (
            <>
              {/* ======================================================== */}
              {/* SECTION 1: MARKET & FAMILY LISTINGS                      */}
              {/* ======================================================== */}
              {section === 'market' && (
                <>
                  <MarketPromotions city={activeLoc.city} district={activeLoc.district}/>

                  {/* Productive Families Spotlight */}
                  {families.length > 0 && (
                    <View style={{ marginBottom: 18 }}>
                      <View style={styles.sectionHead}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}><House size={16} color={OASIS.colors.primary} /><Text style={styles.sectionTitle}>من الأسر المنتجة في حيّك</Text></View>
                        <Pressable onPress={() => setActiveType('home_family')}>
                          <Text style={styles.seeAll}>عرض الكل</Text>
                        </Pressable>
                      </View>
                      <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ flexDirection: 'row-reverse', gap }, { direction: 'ltr' }]}>
                        {families.map((e) => renderMarketCard(e, Math.min(160, cardWidth)))}
                      </ScrollView>
                    </View>
                  )}

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>
                      {activeType === 'all' ? 'أحدث العروض والسلع' : LISTING_TYPES.find((t) => t.id === activeType)?.label}
                    </Text>
                    <View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}>
                      <Text style={styles.resultCount}>{displayedMarket.length} عرض</Text>
                      <View style={styles.viewSwitcher}>
                        <Pressable accessibilityRole="button" accessibilityLabel="عرض شبكي" accessibilityState={{selected:viewMode==='grid'}} onPress={() => setViewMode('grid')} style={[styles.viewSwitch,viewMode==='grid' && styles.viewSwitchActive]}><LayoutGrid size={16} color={viewMode==='grid'?OASIS.colors.primary:OASIS.colors.muted}/></Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="عرض قائمة" accessibilityState={{selected:viewMode==='list'}} onPress={() => setViewMode('list')} style={[styles.viewSwitch,viewMode==='list' && styles.viewSwitchActive]}><List size={16} color={viewMode==='list'?OASIS.colors.primary:OASIS.colors.muted}/></Pressable>
                      </View>
                    </View>
                  </View>

                  {displayedMarket.length > 0 ? (
                    <View style={[viewMode === 'grid' ? styles.grid : styles.list, { gap }]}>
                      {displayedMarket.map((e) => renderMarketCard(e, viewMode === 'grid' ? cardWidth : contentWidth, viewMode === 'list'))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-market" /></View>
                      <Text style={styles.emptyTitle}>{hasFilters ? 'لم نجد عرضًا بهذه الخيارات' : 'لا توجد عروض في هذا الحي حالياً'}</Text>
                      <Text style={styles.emptyText}>
                        {hasFilters ? 'جرّب كلمة بحث أخرى أو امسح الفلاتر للاطلاع على بقية العروض.' : `ستظهر هنا المنتجات والخدمات المتاحة في ${locationLabel}.`}
                      </Text>
                      <Pressable oasisKind="action" style={styles.emptyBtn} onPress={hasFilters ? resetMarketFilters : handleAddPress}>

                        <Plus size={16} color={OASIS.colors.surface} />
                        <Text style={styles.emptyBtnText}>{hasFilters ? 'عرض كل العروض' : 'إضافة عرض'}</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* SECTION 2: BUSINESS DIRECTORY                            */}
              {/* ======================================================== */}
              {section === 'businesses' && (
                <>
                  <View style={styles.filterHintRow}><SlidersHorizontal size={14} color={OASIS.colors.muted} /><Text style={styles.filterHintText}>صفِّ المحلات حسب النشاط من قائمة التصفية</Text></View>

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>دليل المحلات في الحي</Text>
                    <View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}>
                      <Text style={styles.resultCount}>{displayedBusinesses.length} منشأة</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel={viewMode === 'grid' ? 'عرض قائمة المحلات' : 'عرض شبكة المحلات'} style={styles.viewSwitch} onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                        {viewMode === 'grid' ? <List size={18} color={OASIS.colors.primary}/> : <LayoutGrid size={18} color={OASIS.colors.primary}/>}
                      </Pressable>
                    </View>
                  </View>

                  {displayedBusinesses.length > 0 ? (
                    <View style={[viewMode === 'grid' ? styles.grid : styles.list, { gap }]}>
                      {displayedBusinesses.map((b) => renderBusinessCard(b, viewMode === 'grid' ? cardWidth : contentWidth, viewMode === 'list'))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-market" /></View>
                      <Text style={styles.emptyTitle}>دليل المحلات</Text>
                      <Text style={styles.emptyText}>
                        لم يتم تسجيل محلات في هذا التصنيف بعد. هل تملك بقالة، مغسلة، صيدلية، أو نشاطاً تجارياً؟ سجله مجاناً ليظهر لجميع سكان الحي!
                      </Text>
                      <Pressable oasisKind="action" style={[styles.emptyBtn, { backgroundColor: OASIS.colors.info }]} onPress={() => router.push('/new-service')}>
                        <Plus size={16} color={OASIS.colors.surface} />
                        <Text style={styles.emptyBtnText}>سجّل محلك التجاري مجاناً</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* SECTION 3: NEIGHBORHOOD EVENTS                           */}
              {/* ======================================================== */}
              {section === 'events' && (
                <>
                  <View style={styles.filterHintRow}><SlidersHorizontal size={14} color={OASIS.colors.muted} /><Text style={styles.filterHintText}>صفِّ الفعاليات حسب نوع النشاط من قائمة التصفية</Text></View>

                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>فعاليات الحي القادمة</Text>
                    <Text style={styles.resultCount}>{displayedEvents.length} فعالية</Text>
                  </View>

                  {displayedEvents.length > 0 ? (
                    <View style={[styles.list, { gap }]}>
                      {displayedEvents.map((ev) => renderEventCard(ev, contentWidth, true))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-market" /></View>
                      <Text style={styles.emptyTitle}>ملتقيات ومبادرات الحي</Text>
                      <Text style={styles.emptyText}>
                        لا توجد فعاليات مجدولة في الحي حالياً. بادر بتنظيم لقاء أخوي، دوري كرة قدم، أو مبادرة تطوعية واجمع جيرانك!
                      </Text>
                      <Pressable oasisKind="action" style={[styles.emptyBtn, { backgroundColor: '#d97706' }]} onPress={() => setShowEventModal(true)}>
                        <Plus size={16} color={OASIS.colors.surface} />
                        <Text style={styles.emptyBtnText}>نظّم فعالية جديدة للحي</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </>
          )}
          {!loading && !loadError && (section==='market' ? catalogMore.products||catalogMore.services : section==='businesses' ? catalogMore.businesses : catalogMore.events) && <Pressable accessibilityRole="button" disabled={refreshing} onPress={()=>void loadAllData(true)} style={[styles.scopePanel,{alignItems:'center',minHeight:48,justifyContent:'center'}]}>{refreshing?<ActivityIndicator color={OASIS.colors.primary}/>:<Text style={{color:OASIS.colors.primary,fontWeight:'700'}}>تحميل المزيد ضمن نطاقي</Text>}</Pressable>}
        </View>
      </ScrollView>

      <Modal visible={!!filterMenu} transparent animationType="fade" onRequestClose={() => setFilterMenu(null)}>
        <Pressable accessibilityRole="none" focusable={false} style={styles.filterModalBackdrop} onPress={() => setFilterMenu(null)}>
          <OasisSurface oasisSurface="card" style={styles.filterMenuCard}>
            <View style={styles.filterMenuHeader}><Text style={styles.filterMenuTitle}>{filterMenu === 'sort' ? 'ترتيب النتائج' : 'تصفية النتائج'}</Text><Pressable oasisKind="icon" onPress={() => setFilterMenu(null)} style={styles.modalCloseBtn}><X size={17} color={OASIS.colors.ink} /></Pressable></View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {filterMenu === 'sort' ? SORT_OPTIONS.map((opt) => <Pressable key={opt.id} style={styles.filterMenuItem} onPress={() => { setSortBy(opt.id); setFilterMenu(null); }}><opt.Icon size={18} color={sortBy === opt.id ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={[styles.filterMenuItemText, sortBy === opt.id && { color: OASIS.colors.primary, fontWeight: '700' }]}>{opt.label}</Text>{sortBy === opt.id && <Check size={17} color={OASIS.colors.primary} />}</Pressable>) : section === 'market' ? (
                <>
                  <Pressable style={styles.filterMenuItem} onPress={() => { setActiveType('all'); setQuick('all'); setFilterMenu(null); }}><LayoutGrid size={18} color={OASIS.colors.muted} /><Text style={styles.filterMenuItemText}>كل العروض</Text></Pressable>
                  {LISTING_TYPES.map((t) => <Pressable key={t.id} style={styles.filterMenuItem} onPress={() => { setActiveType(t.id); setFilterMenu(null); }}><t.Icon size={18} color={activeType === t.id ? OASIS.colors.primary : t.color} /><Text style={styles.filterMenuItemText}>{t.label}</Text>{activeType === t.id && <Check size={17} color={OASIS.colors.primary} />}</Pressable>)}
                  <View style={styles.filterMenuDivider} />
                  {QUICK_FILTERS.map((f) => <Pressable key={f.id} style={styles.filterMenuItem} onPress={() => { setQuick(f.id); setFilterMenu(null); }}>{f.Icon && <f.Icon size={18} color={quick === f.id ? OASIS.colors.primary : OASIS.colors.muted} />}<Text style={styles.filterMenuItemText}>{f.label}</Text>{quick === f.id && <Check size={17} color={OASIS.colors.primary} />}</Pressable>)}
                </>
              ) : section === 'businesses' ? BUSINESS_CATEGORIES.map((c) => <Pressable key={c.id} style={styles.filterMenuItem} onPress={() => { setBusinessCategory(c.id); setFilterMenu(null); }}><c.Icon size={18} color={businessCategory === c.id ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={styles.filterMenuItemText}>{c.label}</Text>{businessCategory === c.id && <Check size={17} color={OASIS.colors.primary} />}</Pressable>) : EVENT_CATEGORIES.map((c) => <Pressable key={c.id} style={styles.filterMenuItem} onPress={() => { setEventCategory(c.id); setFilterMenu(null); }}><c.Icon size={18} color={eventCategory === c.id ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={styles.filterMenuItemText}>{c.label}</Text>{eventCategory === c.id && <Check size={17} color={OASIS.colors.primary} />}</Pressable>)}
            </ScrollView>
            <Pressable oasisKind="action" style={styles.filterResetBtn} onPress={() => { setActiveType('all'); setBusinessCategory('all'); setEventCategory('all'); setQuick('all'); setFilterMenu(null); }}><Text style={styles.filterResetText}>إعادة ضبط التصفية</Text></Pressable>
          </OasisSurface>
        </Pressable>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 1: BUSINESS DETAILS                                */}
      {/* ======================================================== */}
      {selectedBusiness && (
        <Modal visible={!!selectedBusiness} animationType="slide" transparent onRequestClose={() => setSelectedBusiness(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable oasisKind="icon" onPress={() => setSelectedBusiness(null)} style={styles.modalCloseBtn}>
                  <X size={18} color={OASIS.colors.ink} />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Store size={18} color={OASIS.colors.info} />
                  <Text style={styles.modalTitle}>تفاصيل المحل التجاري</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={[styles.detailHeroBox, { backgroundColor: selectedBusiness.bg || OASIS.colors.infoSoft }]}>
                  <View style={styles.detailHeroIconCircle}>
                    <Text style={{ fontSize: 22 }}><selectedBusiness.Icon size={34} color={selectedBusiness.color || OASIS.colors.info} /></Text>
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.detailHeroTitle}>{selectedBusiness.name}</Text>
                      {selectedBusiness.is_verified && <ShieldCheck size={18} color={OASIS.colors.primary} />}
                    </View>
                    <View style={styles.detailBadgeRow}>
                      <Text style={[styles.detailCatPill, { color: selectedBusiness.color || OASIS.colors.info }]}>
                        {selectedBusiness.categoryLabel}
                      </Text>
                      <View style={styles.detailRatingPill}>
                        <Star size={13} color={OASIS.colors.warning} fill={OASIS.colors.warning} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: OASIS.colors.ink }}>{selectedBusiness.rating == null ? 'لا توجد تقييمات بعد' : selectedBusiness.rating.toFixed(1)}</Text>
                        <Text style={{ fontSize: 11, color: OASIS.colors.muted }}>({selectedBusiness.reviews} تقييم)</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.detailStatusBanner}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Clock size={16} color={OASIS.colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: OASIS.colors.ink }}>
                      {selectedBusiness.hours || 'متاح لخدمة الحي'}
                    </Text>
                  </View>
                  <View style={[styles.statusTag, selectedBusiness.openNow ? styles.statusTagOpen : styles.statusTagClosed]}>
                    <Text style={[styles.statusTagText, selectedBusiness.openNow ? { color: '#15803d' } : { color: OASIS.colors.danger }]}>
                      {selectedBusiness.openNow == null ? 'لم تُحدد حالة العمل' : selectedBusiness.openNow ? 'مفتوح الآن' : 'مغلق حالياً'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailLocationBanner}>
                  <MapPin size={16} color={OASIS.colors.primary} />
                  <Text style={styles.detailLocationText}>
                    الموقع: {selectedBusiness.district ? `حي ${selectedBusiness.district}` : ''} {selectedBusiness.city ? `· ${selectedBusiness.city}` : ''}
                  </Text>
                </View>

                <View style={styles.detailActionsGrid}>
                  {Boolean(selectedBusiness.phone) && (
                    <Pressable style={styles.detailActionBtnCall} onPress={() => openPhone(selectedBusiness.phone)}>
                      <Phone size={16} color={OASIS.colors.info} />
                      <Text style={styles.detailActionBtnCallText}>اتصال مباشر</Text>
                    </Pressable>
                  )}
                  {Boolean(selectedBusiness.whatsapp) && (
                    <Pressable
                      style={styles.detailActionBtnWa}
                      onPress={() => openWhatsApp(selectedBusiness.whatsapp, `مرحباً «${selectedBusiness.name}»، شفت بطاقتكم في تطبيق حيّنا وحاب أستفسر`)}
                    >
                      <MessageCircle size={16} color="#15803d" />
                      <Text style={styles.detailActionBtnWaText}>واتساب</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.detailActionBtnMap}
                    onPress={() => openMaps(`${selectedBusiness.name} ${selectedBusiness.district || ''} ${selectedBusiness.city || ''}`)}
                  >
                    <Navigation size={16} color={OASIS.colors.primary} />
                    <Text style={styles.detailActionBtnMapText}>الخريطة</Text>
                  </Pressable>
                  <Pressable style={styles.detailActionBtnShare} onPress={() => void shareBusiness(selectedBusiness)}>
                    <Share2 size={16} color={OASIS.colors.muted} />
                    <Text style={styles.detailActionBtnShareText}>مشاركة</Text>
                  </Pressable>
                </View>

                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>نبذة عن المنشأة ℹ️</Text>
                  <Text style={styles.detailSectionDesc}>
                    {selectedBusiness.description || 'منشأة معتمدة تقدم خدماتها لسكان الحي بأعلى معايير الجودة والمصداقية.'}
                  </Text>
                </View>

                {selectedBusiness.features && selectedBusiness.features.length > 0 && (
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>المميزات والخدمات المقدمة ⭐</Text>
                    <View style={{ gap: 8, marginTop: 6 }}>
                      {selectedBusiness.features.map((feat: string, idx: number) => (
                        <View key={idx} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={16} color={OASIS.colors.primary} />
                          <Text style={{ fontSize: 13, color: OASIS.colors.ink, fontWeight: '700' }}>{feat}</Text>
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
      {/* MODAL 2: COMMUNITY EVENT DETAILS                         */}
      {/* ======================================================== */}
      {selectedEvent && (
        <Modal visible={!!selectedEvent} animationType="slide" transparent onRequestClose={() => setSelectedEvent(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable oasisKind="icon" onPress={() => setSelectedEvent(null)} style={styles.modalCloseBtn}>
                  <X size={18} color={OASIS.colors.ink} />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Calendar size={18} color={OASIS.colors.primary} />
                  <Text style={styles.modalTitle}>تفاصيل الفعالية والنشاط</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={[styles.detailHeroBox, { backgroundColor: selectedEvent.bg || OASIS.colors.soft }]}>
                  <View style={styles.detailHeroIconCircle}>
                    <Text style={{ fontSize: 22 }}><selectedEvent.Icon size={34} color={selectedEvent.color || OASIS.colors.primary} /></Text>
                  </View>
                  <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
                    <Text style={styles.detailHeroTitle}>{selectedEvent.title}</Text>
                    <View style={styles.detailBadgeRow}>
                      <Text style={[styles.detailCatPill, { color: selectedEvent.color || OASIS.colors.primary }]}>
                        {selectedEvent.categoryLabel}
                      </Text>
                      <View style={[styles.detailRatingPill, { backgroundColor: OASIS.colors.soft, borderColor: '#a7f3d0' }]}>
                        <Award size={13} color={OASIS.colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: OASIS.colors.primary }}>
                          {selectedEvent.isFree ? 'دخول مجاني' : 'تسجيل مسبق'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.detailStatusBanner}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                    <Users size={16} color={OASIS.colors.primary} />
                    <View>
                      <Text style={{ fontSize: 11, color: OASIS.colors.muted }}>الجهة المنظمة</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: OASIS.colors.ink }}>{selectedEvent.organizer || 'أحد سكان الحي'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                    <Users size={14} color={OASIS.colors.primary} />
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: OASIS.colors.primary }}>
                      {selectedEvent.attendeesCount || 0} جار مسجل
                    </Text>
                  </View>
                </View>

                <View style={styles.detailLocationBanner}>
                  <Clock size={16} color="#d97706" />
                  <Text style={[styles.detailLocationText, { color: '#92400e' }]}>
                    الموعد: {selectedEvent.dateLabel}
                  </Text>
                </View>

                <View style={styles.detailLocationBanner}>
                  <MapPin size={16} color={OASIS.colors.primary} />
                  <Text style={styles.detailLocationText}>
                    نقطة التجمع: {selectedEvent.location} ({selectedEvent.district ? `حي ${selectedEvent.district}` : selectedEvent.city || ''})
                  </Text>
                </View>

                {/* RSVP Interactive Button */}
                <View style={{ marginVertical: 12 }}>
                  <Pressable oasisKind="action"
                    style={[styles.bigRsvpBtn, rsvpList[selectedEvent.id] && styles.bigRsvpBtnActive, attendeeActionBusy && { opacity: 0.65 }]}
                    onPress={() => toggleRsvp(selectedEvent.id)}
                    disabled={attendeeActionBusy}
                  >
                    {rsvpList[selectedEvent.id] ? (
                      <>
                        <Check size={20} color={OASIS.colors.surface} />
                        <Text style={styles.bigRsvpBtnText}>تم تسجيل حضورك بنجاح ✓ (انقر للإلغاء)</Text>
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} color={OASIS.colors.surface} />
                        <Text style={styles.bigRsvpBtnText}>تسجيل الحضور في الفعالية (سأحضر)</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <View style={styles.detailActionsGrid}>
                  <Pressable
                    style={styles.detailActionBtnMap}
                    onPress={() => openMaps(`${selectedEvent.location} ${selectedEvent.district || ''} ${selectedEvent.city || ''}`)}
                  >
                    <Navigation size={16} color={OASIS.colors.primary} />
                    <Text style={styles.detailActionBtnMapText}>عرض الموقع بالخريطة</Text>
                  </Pressable>
                  <Pressable style={styles.detailActionBtnShare} onPress={() => void shareEvent(selectedEvent)}>
                    <Share2 size={16} color={OASIS.colors.muted} />
                    <Text style={styles.detailActionBtnShareText}>مشاركة الدعوة</Text>
                  </Pressable>
                </View>

                <View style={styles.detailSectionBox}>
                  <Text style={styles.detailSectionTitle}>عن الفعالية والنشاط</Text>
                  <Text style={styles.detailSectionDesc}>{selectedEvent.description || 'تفاصيل الفعالية سيضيفها المنظم قريباً.'}</Text>
                </View>
                {Array.isArray(selectedEvent.agenda) && selectedEvent.agenda.length > 0 && (
                  <View style={styles.detailSectionBox}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}>
                      <Calendar size={17} color={OASIS.colors.primary} />
                      <Text style={styles.detailSectionTitle}>برنامج الفعالية</Text>
                    </View>
                    <View style={{ gap: 9, marginTop: 8 }}>
                      {selectedEvent.agenda.map((entry: any, index: number) => (
                        <View key={index} style={styles.eventAgendaRow}>
                          <View style={styles.eventAgendaNumber}><Text style={styles.eventAgendaNumberText}>{index + 1}</Text></View>
                          <Text style={[styles.detailSectionDesc, { flex: 1 }]}>{typeof entry === 'string' ? entry : entry?.title || entry?.description || String(entry)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {selectedEvent.guidelines ? (
                  <View style={styles.detailSectionBox}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}>
                      <ShieldCheck size={17} color={OASIS.colors.primary} />
                      <Text style={styles.detailSectionTitle}>إرشادات المشاركة</Text>
                    </View>
                    <Text style={[styles.detailSectionDesc, { marginTop: 7 }]}>{selectedEvent.guidelines}</Text>
                  </View>
                ) : null}


                {selectedEvent.organizerId === profile?.id && (
                  <View style={styles.detailSectionBox}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}><Users size={17} color={OASIS.colors.primary} /><Text style={styles.detailSectionTitle}>قائمة المشاركين في فعاليتك</Text></View>
                      <Text style={{ fontSize: 11, color: OASIS.colors.muted, fontWeight: '700' }}>{eventAttendees.length} مشارك</Text>
                    </View>
                    {loadingAttendees ? <ActivityIndicator color={OASIS.colors.primary} style={{ marginTop: 10 }} /> : eventAttendees.length ? <View style={{ gap: 10, marginTop: 10 }}>{eventAttendees.map((attendee) => <View key={attendee.user_id} style={styles.attendeeRow}><View style={styles.attendeeAvatar}>{attendee.profile?.avatar_url ? <Image source={{ uri: attendee.profile.avatar_url }} style={StyleSheet.absoluteFillObject} /> : <User size={17} color={OASIS.colors.muted} />}</View><View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}><Text style={{ fontSize: 13, color: OASIS.colors.ink, fontWeight: '600' }}>{attendee.profile?.display_name || attendee.profile?.username || 'جارٍ مشارك'}</Text><Text style={{ fontSize: 11, color: OASIS.colors.muted }}>مسجل لحضور الفعالية</Text></View><BadgeCheck size={16} color={OASIS.colors.primary} /></View>)}</View> : <Text style={[styles.detailSectionDesc, { marginTop: 8 }]}>لا يوجد مشاركون مسجلون حتى الآن.</Text>}
                  </View>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PRODUCT / SERVICE PREVIEW                       */}
      {/* ======================================================== */}
      {selectedProduct && (
        <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Pressable oasisKind="icon" onPress={() => setSelectedProduct(null)} style={styles.modalCloseBtn}>
                  <X size={18} color={OASIS.colors.ink} />
                </Pressable>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={18} color={OASIS.colors.primary} />
                  <Text style={styles.modalTitle}>تفاصيل العرض والسلعة</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
                    {selectedProduct.shop_name ? selectedProduct.shop_name : selectedProduct.subcategory || selectedProduct.category || 'عرض محلي'}
                  </Text>

                  {/* Delivery & Status row */}
                  <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {selectedProduct.available_now && (
                      <View style={[styles.statusTag, styles.statusTagOpen]}>
                        <Text style={[styles.statusTagText, { color: '#15803d' }]}>متاح الآن للتسليم</Text>
                      </View>
                    )}
                    {(selectedProduct.delivery_modes || []).map((m: string) => {
                      const dm = getDeliveryMode(m);
                      return dm ? (
                        <View key={m} style={styles.deliveryPill}>
                          {m === 'delivery' ? <Truck size={14} color={OASIS.colors.muted} /> : m === 'remote' ? <ExternalLink size={14} color={OASIS.colors.muted} /> : m === 'home_visit' ? <User size={14} color={OASIS.colors.muted} /> : m === 'at_shop' ? <Store size={14} color={OASIS.colors.muted} /> : <Package size={14} color={OASIS.colors.muted} />}
                          <Text style={styles.deliveryPillText}>{dm.label}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>

                  {/* Location Info */}
                  <View style={[styles.detailLocationBanner, { marginTop: 12 }]}>
                    <MapPin size={16} color={OASIS.colors.primary} />
                    <Text style={styles.detailLocationText}>
                      الموقع: {selectedProduct.district ? `حي ${selectedProduct.district}` : ''} {selectedProduct.city ? `· ${selectedProduct.city}` : 'داخل الحي'}
                    </Text>
                  </View>

                  {/* Description */}
                  <View style={styles.detailSectionBox}>
                    <Text style={styles.detailSectionTitle}>وصف السلعة والتفاصيل</Text>
                    <Text style={styles.detailSectionDesc}>
                      {selectedProduct.description || 'عرض متاح من أحد سكان أو أسر الحي، تم فحصه لضمان أفضل تجربة.'}
                    </Text>
                  </View>

                  {/* Provider Info */}
                  {selectedProduct.profiles && (
                    <View style={styles.detailStatusBanner}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                        {selectedProduct.profiles.avatar_url ? (
                          <Image source={{ uri: selectedProduct.profiles.avatar_url }} style={{ width: 36, height: 36, borderRadius: 14 }} />
                        ) : (
                          <View style={{ width: 36, height: 36, borderRadius: 14, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: OASIS.colors.primary }}>
                              {selectedProduct.profiles.display_name?.[0] || 'ج'}
                            </Text>
                          </View>
                        )}
                        <View>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: OASIS.colors.ink }}>
                              {selectedProduct.profiles.display_name || 'أحد الجيران'}
                            </Text>
                            {selectedProduct.profiles.is_verified && <ShieldCheck size={14} color={OASIS.colors.primary} />}
                          </View>
                          <Text style={{ fontSize: 11, color: OASIS.colors.muted }}>معلن موثق بالحي</Text>
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
                        <Phone size={16} color={OASIS.colors.info} />
                        <Text style={styles.detailActionBtnCallText}>اتصال</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.detailActionBtnShare} onPress={() => void shareItem(selectedProduct)}>
                      <Share2 size={16} color={OASIS.colors.muted} />
                      <Text style={styles.detailActionBtnShareText}>مشاركة</Text>
                    </Pressable>
                  </View>

                  {/* Open Dedicated Page Button */}
                  <Pressable oasisKind="action"
                    style={styles.fullPageBtn}
                    onPress={() => {
                      setSelectedProduct(null);
                      router.push({ pathname: '/service', params: { id: selectedProduct.id } });
                    }}
                  >
                    <ExternalLink size={16} color={OASIS.colors.surface} />
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
              <Pressable oasisKind="icon" onPress={() => setShowEventModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color={OASIS.colors.ink} />
              </Pressable>
              <Text style={styles.modalTitle}>إضافة فعالية جديدة للحي</Text>
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
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ flexDirection: 'row-reverse', gap: 6, paddingVertical: 4 }, { direction: 'ltr' }]}>
                {EVENT_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <Pressable oasisKind="chip"
                    key={c.id}
                    onPress={() => setEventCategoryChoice(c.id)}
                    style={[styles.quickChip, eventCategoryChoice === c.id && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickText, eventCategoryChoice === c.id && styles.quickTextActive]}>
                      {c.label}
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

              <Pressable oasisKind="action"
                style={[styles.submitEventBtn, savingEvent && { opacity: 0.6 }]}
                onPress={handleCreateEvent}
                disabled={savingEvent}
              >
                {savingEvent ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <>
                    <Calendar size={18} color={OASIS.colors.surface} />
                    <Text style={styles.submitEventBtnText}>نشر الفعالية لسكان الحي</Text>
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
    <Pressable onPress={onPress} style={({ pressed }: any) => [styles.typeItem, pressed && { opacity: 0.75 }]}>
      <View style={[styles.typeCircle, { backgroundColor: active ? color : bg }, active && styles.typeCircleActive]}>
        <Icon size={22} color={active ? OASIS.colors.surface : color} />
        {count > 0 && (
          <View style={[styles.typeCount, { borderColor: active ? color : OASIS.colors.surface }]}>
            <Text style={styles.typeCountText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.typeLabel, active && { color, fontWeight: '700' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scopePanel:{padding:13,gap:11,borderRadius:19,borderWidth:1,borderColor:OASIS.colors.line,marginBottom:12},
  scopeOption:{flex:1,minHeight:42,borderRadius:14,alignItems:'center',justifyContent:'center'},
  container: { flex: 1, backgroundColor: OASIS.colors.background, width: '100%' },
  inner: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingHorizontal: 16 },

  headerAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerAddBtnText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '600' },

  // Hero Section
  heroSectionWrap: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  heroCard: {
    borderRadius: 24,
    padding: 14,
    shadowColor: OASIS.colors.primary,
    shadowOpacity: 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: '#fef08a' },
  heroLocBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroLocText: { fontSize: 11, fontWeight: '700', color: '#a7f3d0' },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff', textAlign: 'right', marginTop: 2 },
  heroSubtitle: { fontSize: 12, color: '#d1fae5', textAlign: 'right', marginTop: 4, lineHeight: 19 },
  workspaceShortcut: { marginRight:12, width:58, minHeight:64, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.24)', backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center',justifyContent:'center',gap:6 },
  workspaceShortcutText: { color:'#ffffff', fontSize:11,fontWeight:'600' },
  discoveryChips: { flexDirection:'row-reverse',gap:8,paddingTop:10,paddingBottom:4 },
  discoveryChip: { flexDirection:'row-reverse',alignItems:'center',gap:5,paddingHorizontal:12,minHeight:36,borderRadius:18,borderWidth:1,borderColor:OASIS.colors.line,backgroundColor:OASIS.colors.surface },
  discoveryChipActive: { backgroundColor:OASIS.colors.soft,borderColor:OASIS.colors.primary },
  discoveryChipText: { fontSize:11,fontWeight:'600',color:OASIS.colors.muted },
  browseToolbar: { flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:10 },
  browseCaption: { color:OASIS.colors.muted,fontSize:11,textAlign:'right',flex:1 },
  partialNotice: {marginTop:10,padding:12,borderRadius:14,backgroundColor:OASIS.colors.soft,borderWidth:1,borderColor:OASIS.colors.line},
  partialNoticeText: {color:OASIS.colors.ink,fontSize:12,lineHeight:20,textAlign:'right'},
  clearFilters: { flexDirection:'row-reverse',alignItems:'center',gap:4,minHeight:36 },
  clearFiltersText: {color:OASIS.colors.primary,fontSize:11,fontWeight:'600'},
  viewSwitcher: {flexDirection:'row-reverse',padding:3,borderRadius:14,backgroundColor:OASIS.colors.background,borderWidth:1,borderColor:OASIS.colors.line},
  viewSwitch: {width:36,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},
  viewSwitchActive: {backgroundColor:OASIS.colors.soft},

  // Live Neighborhood KPI Ribbon
  kpiRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  kpiItem: { flex: 1, alignItems: 'center', gap: 2 },
  kpiVal: { fontSize: 14, fontWeight: '700', color: OASIS.colors.surface },
  kpiLbl: { fontSize: 11, color: '#a7f3d0', fontWeight: '700' },
  kpiDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.18)' },

  filterControlsRow: { flexDirection: 'row-reverse', gap: 10, marginTop: 10 },
  filterSelect: { flex: 1, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11 },
  filterSelectLabel: { fontSize: 11, color: OASIS.colors.muted, fontWeight: '700' },
  filterSelectValue: { flex: 1, fontSize: 11.5, color: OASIS.colors.ink, fontWeight: '700', textAlign: 'right' },
  filterHintRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 2 },
  filterHintText: { fontSize: 11, color: OASIS.colors.muted, fontWeight: '600' },
  filterModalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'center', padding: 14 },
  filterMenuCard: { backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 14, maxWidth: 520, width: '100%', alignSelf: 'center', maxHeight: '85%' },
  filterMenuHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 4 },
  filterMenuTitle: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink },
  filterMenuItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: OASIS.colors.background },
  filterMenuItemText: { flex: 1, textAlign: 'right', fontSize: 13, color: OASIS.colors.ink, fontWeight: '700' },
  filterMenuDivider: { height: 1, backgroundColor: OASIS.colors.line, marginVertical: 5 },
  filterResetBtn: { alignItems: 'center', paddingVertical: 11, marginTop: 8, borderRadius: 10, backgroundColor: '#f1f5f9' },
  filterResetText: { fontSize: 12, color: OASIS.colors.muted, fontWeight: '600' },
  attendeeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  eventAgendaRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9 },
  eventAgendaNumber: { width: 25, height: 25, borderRadius: 9, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  eventAgendaNumberText: { fontSize: 11, color: OASIS.colors.primary, fontWeight: '700' },
  attendeeAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  // Sticky Wrap
  stickyWrap: {
    backgroundColor: OASIS.colors.surface,
    paddingBottom: 10,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: OASIS.colors.ink,
    shadowOpacity: 0,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 4,
  },

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
    backgroundColor: OASIS.colors.primary,
    shadowColor: OASIS.colors.primary,
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: OASIS.colors.muted,
  },
  segmentTextActive: {
    color: OASIS.colors.surface,
    fontWeight: '700',
  },
  segmentCount: {
    backgroundColor: OASIS.colors.line,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.muted,
  },
  segmentCountTextActive: {
    color: OASIS.colors.surface,
  },

  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: '#f1f5f9', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  searchInput: { flex: 1, color: OASIS.colors.ink, fontSize: 13.5, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  addBtn: { height: 46, minWidth: 46, paddingHorizontal: 14, borderRadius: 15, backgroundColor: OASIS.colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addBtnText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },

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
  sortBarLabel: { fontSize: 11, fontWeight: '600', color: OASIS.colors.muted },
  sortChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  sortChipActive: {
    backgroundColor: OASIS.colors.primary,
    borderColor: OASIS.colors.primary,
  },
  sortChipText: { fontSize: 11, fontWeight: '700', color: OASIS.colors.muted },
  sortChipTextActive: { color: OASIS.colors.surface, fontWeight: '600' },

  // Category Icons Row
  typesScroll: { marginTop: 12 },
  typesRow: { flexDirection: 'row-reverse', gap: 14, paddingBottom: 4 },
  typeItem: { alignItems: 'center', width: 64 },
  typeCircle: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeCircleActive: { shadowColor: '#000', shadowOpacity: 0, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  typeCount: { position: 'absolute', top: -4, left: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: OASIS.colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  typeCountText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  typeLabel: { fontSize: 11.5, color: OASIS.colors.muted, fontWeight: '700', marginTop: 6 },

  quickRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 10 },
  quickChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  quickChipActive: { backgroundColor: OASIS.colors.ink, borderColor: OASIS.colors.ink },
  quickText: { fontSize: 12, color: OASIS.colors.muted, fontWeight: '700' },
  quickTextActive: { color: OASIS.colors.surface },

  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap:8, marginBottom: 10, marginTop: 10, padding:10, borderRadius:18, backgroundColor:OASIS.colors.surface, borderWidth:1, borderColor:OASIS.colors.line },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  seeAll: { fontSize: 12, color: OASIS.colors.primary, fontWeight: '600' },
  resultCount: { fontSize: 11.5, color: '#94a3b8', fontWeight: '700' },

  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  list: { flexDirection: 'column', width: '100%' },
  card: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: OASIS.colors.ink,
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' ? ({ transition: 'transform 160ms ease, box-shadow 160ms ease', cursor: 'pointer' } as any) : {}),
  },
  cardRow: { flexDirection: 'row-reverse', alignItems: 'stretch', minHeight: 124, borderRadius: 16 },
  cardImageRow: { width: 112, height: 124, flexShrink: 0, borderRadius: 0 },
  cardBodyRow: { flex: 1, minWidth: 0, justifyContent: 'center', padding: 12 },
  cardHover: {
    transform: [{ translateY: -3 }],
    shadowColor: OASIS.colors.ink,
    shadowOpacity: 0,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    borderColor: '#cbd5e1',
  },
  cardImage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  typeBadge: { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  availableBadgePill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  availableBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  cardTopActions: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', gap: 5 },
  shareFab: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0, shadowRadius: 3, elevation: 2 },
  cardBody: { padding: 10, paddingTop: 9 },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  cardSub: { fontSize: 11.5, color: OASIS.colors.muted, textAlign: 'right', marginTop: 2, lineHeight: 16 },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 4 },
  cardPrice: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.primary, flexShrink: 1 },
  cardModes: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardModeIcon: { width: 22, height: 22, borderRadius: 7, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cardTimeText: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  cardMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 6 },
  cardMetaText: { fontSize: 11, color: '#94a3b8', fontWeight: '600', flexShrink: 1 },
  cardDetailsHintRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: OASIS.colors.background,
  },
  cardDetailsHintText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.primary },

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
    backgroundColor: OASIS.colors.infoSoft,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  bizBtnCallText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.info },
  bizBtnWa: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.soft,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bizBtnWaText: { fontSize: 11, fontWeight: '600', color: '#15803d' },
  bizBtnMap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.background,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  bizBtnMapText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.muted },

  // Event Card Elements
  eventInfoBox: {
    backgroundColor: OASIS.colors.background,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  eventInfoText: { fontSize: 11, color: OASIS.colors.ink, fontWeight: '700' },
  rsvpBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  rsvpBtnActive: {
    backgroundColor: OASIS.colors.primary,
    borderColor: OASIS.colors.primary,
  },
  rsvpBtnText: { fontSize: 11, fontWeight: '700', color: OASIS.colors.primary },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20, backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, marginVertical: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 14, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: OASIS.colors.ink, marginTop: 12 },
  emptyText: { fontSize: 12.5, color: OASIS.colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 19, maxWidth: 380 },
  emptyBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 0, marginTop: 16 },
  emptyBtnText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },

  // Modals Core
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: OASIS.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 14, marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: OASIS.colors.ink },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right', marginBottom: 6 },
  modalInput: { backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: OASIS.colors.ink, textAlign: 'right' },
  submitEventBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: OASIS.colors.primary, borderRadius: 14, paddingVertical: 13, marginTop: 18 },
  submitEventBtnText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },

  // Detailed Modals Elements
  detailHeroBox: { borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 14 },
  detailHeroIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0, shadowRadius: 8, elevation: 3 },
  detailHeroTitle: { fontSize: 19, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'center' },
  detailBadgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 6 },
  detailCatPill: { fontSize: 12, fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  detailRatingPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: OASIS.colors.surface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#fef3c7' },

  detailStatusBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OASIS.colors.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 10,
  },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusTagOpen: { backgroundColor: '#dcfce7' },
  statusTagClosed: { backgroundColor: '#fee2e2' },
  statusTagText: { fontSize: 11, fontWeight: '600' },

  detailLocationBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.background,
    padding: 11,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailLocationText: { fontSize: 12.5, fontWeight: '700', color: OASIS.colors.ink, flex: 1, textAlign: 'right' },

  detailActionsGrid: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  detailActionBtnCall: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.infoSoft,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnCallText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.info },
  detailActionBtnWa: {
    flex: 1.2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnWaText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.primary },
  detailActionBtnMap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    borderRadius: 12,
    paddingVertical: 10,
  },
  detailActionBtnMapText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.primary },
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
  detailActionBtnShareText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.muted },

  detailSectionBox: { backgroundColor: OASIS.colors.background, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', marginBottom: 6 },
  detailSectionDesc: { fontSize: 13, color: OASIS.colors.muted, lineHeight: 20, textAlign: 'right' },

  // Big RSVP button
  bigRsvpBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: OASIS.colors.primary,
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 4,
  },
  bigRsvpBtnActive: {
    backgroundColor: OASIS.colors.primary,
  },
  bigRsvpBtnText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },

  // Product Preview Modal Elements
  productModalImgWrap: { width: '100%', height: 210, borderRadius: 14, overflow: 'hidden', marginBottom: 10, backgroundColor: '#f1f5f9' },
  productModalTitle: { fontSize: 18, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', flex: 1 },
  productModalPrice: { fontSize: 18, fontWeight: '700', color: OASIS.colors.primary },
  productModalSub: { fontSize: 13, color: OASIS.colors.muted, textAlign: 'right', marginTop: 4 },
  deliveryPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  deliveryPillText: { fontSize: 11, fontWeight: '700', color: OASIS.colors.ink },
  fullPageBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.ink,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
  },
  fullPageBtnText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },
});
