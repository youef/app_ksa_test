import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Platform, Pressable, ScrollView, TextInput, Image, RefreshControl, Share, useWindowDimensions, Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import ScreenState from '@/components/shared/ScreenState';
import { ShoppingBag, MapPin, ShieldCheck, Plus, Search, Bell, ChevronDown, LayoutGrid, Send, X, MessageCircle, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { relativeTime } from '@/lib/mapPins';
import {
  getActiveLocation,
  subscribeLocation,
  isLocationMatching,
  isAllKingdom,
} from '@/lib/locationSync';
import {
  LISTING_TYPES, ListingTypeId, getListingType, getDeliveryMode, formatServicePrice, getServiceCover,
} from '@/lib/serviceTypes';

type QuickFilter = 'all' | 'available' | 'delivery' | 'images';
const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'available', label: '🟢 متاح الآن' },
  { id: 'delivery', label: '🚗 توصيل' },
  { id: 'images', label: '📷 بالصور' },
];

export default function Market() {
  const bottomNavInset = useBottomNavInset();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeType, setActiveType] = useState<ListingTypeId | 'all'>('all');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  const contentWidth = Math.min(width, 1100) - 32;
  const columns = contentWidth > 900 ? 4 : contentWidth > 600 ? 3 : 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  useEffect(() => {
    const loadHeader = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: p }, { count }] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url, is_geoverified').eq('id', u.user.id).maybeSingle(),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', u.user.id).is('read_at', null),
      ]);
      setProfile(p); setUnreadNotifCount(count ?? 0);
    };
    void loadHeader();
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    return unsub;
  }, []);

  useEffect(() => { loadMarketItems(); }, []);

  const loadMarketItems = async () => {
    setRefreshing(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        profiles:provider_id(display_name, avatar_url, is_verified)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      setLoadError(true);
      setItems([]);
    } else {
      setItems(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  // Items resolved with their listing type + location match
  const enriched = useMemo(() => items.map((item) => {
    const type = getListingType(item.listing_type, item.category);
    const locItem = {
      city: item.city || item.profiles?.city || null,
      district: item.district || item.profiles?.district || null,
    };
    const inArea = type?.nationwide || isLocationMatching(locItem, activeLoc.city, activeLoc.district);
    return { item, type, inArea };
  }), [items, activeLoc]);

  const inAreaItems = enriched.filter((e) => e.inArea);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inAreaItems.forEach((e) => { if (e.type) counts[e.type.id] = (counts[e.type.id] || 0) + 1; });
    return counts;
  }, [inAreaItems]);

  const query = searchQuery.trim().toLocaleLowerCase('ar');
  const displayed = inAreaItems.filter(({ item, type }) => {
    if (activeType !== 'all' && type?.id !== activeType) return false;
    if (quick === 'available' && !item.available_now) return false;
    if (quick === 'delivery' && !(item.delivery_modes || []).includes('delivery')) return false;
    if (quick === 'images' && !getServiceCover(item)) return false;
    if (!query) return true;
    return [item.name, item.description, item.category, item.subcategory, item.shop_name, item.profiles?.display_name, item.district, type?.label]
      .some((v) => String(v || '').toLocaleLowerCase('ar').includes(query));
  });

  const families = activeType === 'all' && quick === 'all' && !query
    ? inAreaItems.filter((e) => e.type?.id === 'home_family').slice(0, 10)
    : [];

  const shareItem = async (item: any) => {
    const text = `شوف هذا العرض في حيّنا: ${item.name} — ${formatServicePrice(item)}`;
    try {
      await Share.share({
        message: Platform.OS === 'web' ? `${text} — ${window.location.origin}/service?id=${item.id}` : text,
        title: item.name,
      });
    } catch {}
  };

  const openItem = (id: string) => router.push({ pathname: '/service', params: { id } });

  const renderCard = ({ item, type }: { item: any; type: ReturnType<typeof getListingType> }, w: number) => {
    const cover = getServiceCover(item);
    const modes: string[] = (item.delivery_modes || []).slice(0, 3);
    const timeAgo = relativeTime(item.created_at);

    const quickWhatsApp = (e: any) => {
      e?.stopPropagation?.();
      if (!item.whatsapp) return;
      const raw = String(item.whatsapp).replace(/\D/g, '');
      const intl = raw.startsWith('966') ? raw : raw.startsWith('0') ? '966' + raw.slice(1) : '966' + raw;
      const msg = encodeURIComponent(`مرحباً، شفت عرضك «${item.name}» في سوق الحي بحيّنا وحاب أستفسر`);
      Linking.openURL(`https://wa.me/${intl}?text=${msg}`).catch(() => {});
    };

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
              <Pressable hitSlop={8} style={[styles.shareFab, { backgroundColor: '#25D366' }]} onPress={quickWhatsApp}>
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
            {Boolean(timeAgo) && (
              <Text style={styles.cardTimeText}>· {timeAgo}</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const locationLabel = isAllKingdom(activeLoc.city)
    ? 'كل مناطق المملكة'
    : activeLoc.city + (activeLoc.district !== 'كل الأحياء' ? ' · حي ' + activeLoc.district : '');

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 16 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMarketItems} tintColor="#059669" />}
      >
        {/* Compact header */}
        <View style={styles.header}>
          <View style={styles.inner}>
            <View style={styles.topRow}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.headerTitle}>سوق الحي</Text>
                <View style={styles.locRow}>
                  <MapPin size={12} color="#059669" />
                  <Text style={styles.locText} numberOfLines={1}>{locationLabel}</Text>
                  <ChevronDown size={12} color="#94a3b8" />
                </View>
              </View>
              <View style={styles.headerActions}>
                <Pressable onPress={() => router.push('/notifications')} style={styles.iconBtn}>
                  <Bell size={19} color="#334155" />
                  {unreadNotifCount > 0 && <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text></View>}
                </Pressable>
                <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
                  {profile?.avatar_url
                    ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                    : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text></View>}
                  {profile?.is_geoverified && <View style={styles.avatarVerified}><ShieldCheck size={9} color="#fff" /></View>}
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Sticky search */}
        <View style={styles.stickyWrap}>
          <View style={[styles.inner, styles.searchRow]}>
            <View style={styles.searchBox}>
              <Search size={18} color="#94a3b8" />
              <TextInput
                id="market-search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="ابحث عن منتج، خدمة، أو محل..."
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                textAlign="right"
              />
              {!!searchQuery && <Pressable onPress={() => setSearchQuery('')}><X size={16} color="#94a3b8" /></Pressable>}
            </View>
            <Pressable id="market-add" style={styles.addBtn} onPress={() => router.push('/new-service')}>
              <Plus size={18} color="#fff" />
              {width > 380 && <Text style={styles.addBtnText}>أضف عرضك</Text>}
            </Pressable>
          </View>
        </View>

        <View style={styles.inner}>
          {loading ? (
            <ScreenState type="loading" title="جاري تجهيز السوق" message="نرتب لك عروض الحي الأقرب إليك" />
          ) : loadError ? (
            <View style={{ paddingVertical: 24 }}>
              <ScreenState type="error" title="تعذر تحميل السوق" message="اسحب للتحديث وحاول مرة أخرى" />
            </View>
          ) : (
            <>
              {/* Listing types */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typesRow} style={styles.typesScroll}>
                <TypeCircle
                  label="الكل" active={activeType === 'all'} color="#059669" bg="#ecfdf5"
                  Icon={LayoutGrid} count={inAreaItems.length} onPress={() => setActiveType('all')}
                />
                {LISTING_TYPES.map((t) => (
                  <TypeCircle
                    key={t.id} label={t.short} active={activeType === t.id} color={t.color} bg={t.bg}
                    Icon={t.Icon} count={typeCounts[t.id] || 0}
                    onPress={() => setActiveType(activeType === t.id ? 'all' : t.id)}
                  />
                ))}
              </ScrollView>

              {/* Quick filters */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                {QUICK_FILTERS.map((f) => (
                  <Pressable key={f.id} onPress={() => setQuick(f.id)} style={[styles.quickChip, quick === f.id && styles.quickChipActive]}>
                    <Text style={[styles.quickText, quick === f.id && styles.quickTextActive]}>{f.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Productive families spotlight */}
              {families.length > 0 && (
                <View style={{ marginBottom: 18 }}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>🏠 من الأسر المنتجة في حيّك</Text>
                    <Pressable onPress={() => setActiveType('home_family')}><Text style={styles.seeAll}>عرض الكل</Text></Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap }}>
                    {families.map((e) => renderCard(e, Math.min(160, cardWidth)))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>
                  {activeType === 'all' ? 'أحدث العروض' : LISTING_TYPES.find((t) => t.id === activeType)?.label}
                </Text>
                <Text style={styles.resultCount}>{displayed.length} عرض</Text>
              </View>

              {displayed.length > 0 ? (
                <View style={[styles.grid, { gap }]}>
                  {displayed.map((e) => renderCard(e, cardWidth))}
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
        </View>
      </ScrollView>
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
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, height: 46, borderRadius: 14, backgroundColor: '#f1f5f9', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  addBtn: { height: 46, minWidth: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#059669', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  typesScroll: { marginTop: 16 },
  typesRow: { flexDirection: 'row-reverse', gap: 14, paddingBottom: 4 },
  typeItem: { alignItems: 'center', width: 64 },
  typeCircle: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  typeCircleActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  typeCount: { position: 'absolute', top: -4, left: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  typeCountText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  typeLabel: { fontSize: 11.5, color: '#475569', fontWeight: '700', marginTop: 6 },

  quickRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 14 },
  quickChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  quickChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  quickText: { fontSize: 12.5, color: '#475569', fontWeight: '700' },
  quickTextActive: { color: '#fff' },

  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  seeAll: { fontSize: 12.5, color: '#059669', fontWeight: '800' },
  resultCount: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },

  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7',
    ...(Platform.OS === 'web' ? ({ transition: 'transform 160ms ease, box-shadow 160ms ease' } as any) : {}),
  },
  cardHover: { transform: [{ translateY: -3 }], shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  cardImage: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  typeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '900' },
  availableBadgePill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  availableDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  availableBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#15803d' },
  cardTopActions: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', gap: 5 },
  shareFab: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10, paddingTop: 9 },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  cardSub: { fontSize: 11.5, color: '#64748b', textAlign: 'right', marginTop: 2 },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 4 },
  cardPrice: { fontSize: 13.5, fontWeight: '900', color: '#059669', flexShrink: 1 },
  cardModes: { fontSize: 11 },
  cardTimeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  cardMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 6 },
  cardMetaText: { fontSize: 10.5, color: '#94a3b8', fontWeight: '600', flexShrink: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eef2f7' },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginTop: 12 },
  emptyText: { fontSize: 12.5, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#059669', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
