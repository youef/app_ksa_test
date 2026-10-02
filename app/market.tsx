import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, RefreshControl, TextInput, ScrollView, Share, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';
import ScreenState from '@/components/shared/ScreenState';
import { ShoppingBag, MapPin, ShieldCheck, Plus, Search, Sparkles, SlidersHorizontal, Clock3, Send, ChevronLeft, Bell, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import {
  getActiveLocation,
  subscribeLocation,
  isLocationMatching,
  isAllKingdom,
} from '@/lib/locationSync';

export default function Market() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });
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

  const availableCategories = ['الكل', ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const displayedItems = items.filter((item) => {
    const locItem = {
      city: item.city || item.profiles?.city || null,
      district: item.district || item.profiles?.district || null,
    };
    const matchesLocation = isLocationMatching(locItem, activeLoc.city, activeLoc.district);
    const matchesCategory = activeCategory === 'الكل' || item.category === activeCategory;
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    const matchesSearch = !query || [item.name, item.description, item.category, item.profiles?.display_name, item.district]
      .some((value) => String(value || '').toLocaleLowerCase('ar').includes(query));
    return matchesLocation && matchesCategory && matchesSearch;
  });

  const shareItem = async (item: any) => {
    const text = `شوف هذا العرض في حيّنا: ${item.name}${item.price_from != null ? ` — ${item.price_from} ر.س` : ''}`;
    try {
      await Share.share({
        message: Platform.OS === 'web' ? `${text} — ${window.location.origin}/service?id=${item.id}` : text,
        title: item.name,
      });
    } catch {}
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/service', params: { id: item.id } })}
    >
      <View style={styles.cardImagePlaceholder}>
        <View style={styles.cardArt}><Sparkles size={26} color="#059669" /><Text style={styles.cardArtLabel}>{item.category || 'خدمة محلية'}</Text></View>
        {item.available_now && <View style={styles.availableBadge}><View style={styles.availableDot} /><Text style={styles.availableText}>متاح الآن</Text></View>}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <View style={styles.priceTag}>
          <Text style={styles.priceText}>{item.price_from != null ? `${item.price_from} ر.س` : 'حسب الاتفاق'}</Text>
          </View>
        </View>
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.providerInfo}>
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{item.profiles?.display_name?.[0] || 'ح'}</Text>
            </View>
          )}
          <View style={styles.providerMeta}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Text style={styles.providerName}>{item.profiles?.display_name || 'بائع غير معروف'}</Text>
              {item.profiles?.is_verified && <ShieldCheck size={14} color="#10b981" style={{ marginRight: 4 }} />}
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 3 }}>
              <MapPin size={12} color="#94a3b8" />
              <Text style={styles.districtText}>{item.city || item.profiles?.city || 'داخل الحي'}{(item.district || item.profiles?.district) ? ` · حي ${item.district || item.profiles?.district}` : ''}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable style={styles.detailsButton} onPress={() => router.push({ pathname: '/service', params: { id: item.id } })}>
            <Text style={styles.detailsText}>عرض التفاصيل</Text>
            <ChevronLeft size={16} color="#047857" />
          </Pressable>
          <Pressable style={styles.shareButton} onPress={() => void shareItem(item)}>
            <Send size={15} color="#059669" />
            <Text style={styles.shareText}>إرسال</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMarketItems} tintColor="#059669" />}
      >
        <LinearGradient colors={['#065f46', '#059669', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.homeHeader}>
          <View style={styles.topNavRow}>
            <View style={styles.leftActions}>
              <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
                {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text></View>}
                {profile?.is_geoverified && <View style={styles.avatarVerifiedBadge}><ShieldCheck size={10} color="#fff" /></View>}
              </Pressable>
              <Pressable onPress={() => router.push('/notifications')} style={styles.iconCircleBtn}>
                <Bell size={20} color="#fff" />
                {unreadNotifCount > 0 && <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text></View>}
              </Pressable>
            </View>
            <View style={styles.brandAndLocation}>
              <Image source={{ uri: '/assets/branding/HAYNA_LOGO.png?v=2' }} style={styles.headerLogo} resizeMode="contain" />
              <View style={styles.locationSelectorPill}>
                <ChevronDown size={14} color="#a7f3d0" />
                <Text style={styles.locationSelectorText} numberOfLines={1}>{isAllKingdom(activeLoc.city) ? 'كل مناطق المملكة' : activeLoc.city + (activeLoc.district !== 'كل الأحياء' ? ' · حي ' + activeLoc.district : '')}</Text>
                <MapPin size={13} color="#6ee7b7" />
              </View>
            </View>
          </View>
          <View style={styles.headerSearchWrap}>
            <View style={styles.searchBox}>
              <Search size={20} color="#94a3b8" />
              <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="ابحث عن خدمة أو منتج..." placeholderTextColor="#94a3b8" style={styles.searchInput} textAlign="right" />
            </View>
          </View>
        </LinearGradient>

        <View style={styles.marketBody}>
          {loading ? (
            <ScreenState type="loading" title="جاري تجهيز السوق" message="نرتب لك عروض الحي الأقرب إليك" />
          ) : loadError ? (
            <View style={styles.inlineState}>
              <ScreenState type="error" title="تعذر تحميل السوق" message="اسحب للتحديث وحاول مرة أخرى" />
            </View>
          ) : (
          <>
          <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroTop}><View style={styles.heroIcon}><ShoppingBag size={24} color="#d1fae5" /></View><Text style={styles.heroEyebrow}>سوق الجيران</Text></View>
          <Text style={styles.heroTitle}>كل ما تحتاجه،{`\n`}من أهل حيك</Text>
          <Text style={styles.heroSubtitle}>اكتشف خدمات ومنتجات محلية وادعم أصحاب المشاريع القريبة.</Text>
          <View style={styles.heroActions}>
            <Pressable style={styles.heroAddButton} onPress={() => router.push('/new-service')}>
              <Plus size={17} color="#065f46" />
              <Text style={styles.heroAddText}>أضف عرضك</Text>
            </Pressable>
          </View>
          <View style={styles.heroStats}><View><Text style={styles.statValue}>{displayedItems.length}</Text><Text style={styles.statLabel}>عرض متاح</Text></View><View style={styles.statDivider} /><View><Text style={styles.statValue}>{activeLoc.city}</Text><Text style={styles.statLabel}>نطاق التصفح</Text></View></View>
          <View style={styles.heroDecor}><Sparkles size={76} color="rgba(255,255,255,0.10)" /></View>
          </View>
        
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>تصفّح السوق</Text><Text style={styles.sectionHint}>اختر القسم المناسب لك</Text></View><SlidersHorizontal size={18} color="#64748b" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {availableCategories.map((category) => (
            <Pressable 
              key={category} 
              style={[styles.categoryPill, activeCategory === category && styles.categoryPillActive]}
              onPress={() => setActiveCategory(category)}
            >
              <Text style={[styles.categoryText, activeCategory === category && { color: '#fff' }]}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.listContainer}>
          <View style={styles.resultsHeader}><Text style={styles.resultCount}>{displayedItems.length} نتيجة</Text><View style={styles.latestLabel}><Clock3 size={13} color="#64748b" /><Text style={styles.latestText}>الأحدث</Text></View></View>
          {displayedItems.length > 0 ? (
            displayedItems.map(item => (
              <React.Fragment key={item.id}>
                {renderItem({ item })}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {!isAllKingdom(activeLoc.city)
                  ? `لا توجد خدمات متاحة حالياً في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}`
                  : 'لا توجد عروض في هذا القسم حالياً'}
              </Text>
            </View>
          )}
        </View>
          )}
          </>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingHorizontal: 0,
    width: '100%',
    paddingBottom: 110,
  },
  marketBody: {
    paddingHorizontal: 16,
    width: '100%',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  homeHeader: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  topNavRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  leftActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: { width: 42, height: 42, borderRadius: 21, position: 'relative' },
  avatarImg: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'rgba(255,255,255,.7)' },
  avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 17, fontWeight: '900' },
  avatarVerifiedBadge: { position: 'absolute', right: -2, bottom: -1, width: 17, height: 17, borderRadius: 9, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  iconCircleBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  brandAndLocation: { alignItems: 'flex-end', flex: 1, marginLeft: 14 },
  headerLogo: { width: 74, height: 32, marginBottom: 4 },
  locationSelectorPill: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 210 },
  locationSelectorText: { color: '#ecfdf5', fontSize: 11, fontWeight: '800', flexShrink: 1 },
  headerSearchWrap: { marginTop: 16 },
  heroCard: {
    backgroundColor: '#064e3b', borderRadius: 28, padding: 22, marginBottom: 20, overflow: 'hidden',
    minHeight: 235,
    shadowColor: '#064e3b', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 6,
  },
  heroGlowOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(16,185,129,.16)', right: -70, top: -80 },
  heroGlowTwo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,.08)', left: -45, bottom: -45 },
  heroActions: { marginTop: 16, flexDirection: 'row-reverse' },
  heroAddButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: '#ecfdf5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 15, alignSelf: 'flex-start' },
  heroAddText: { color: '#065f46', fontSize: 13, fontWeight: '900' },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  heroIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: '#a7f3d0', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 27, fontWeight: '900', textAlign: 'right', lineHeight: 36, marginTop: 14 },
  heroSubtitle: { color: '#d1fae5', fontSize: 13, lineHeight: 21, textAlign: 'right', marginTop: 8, maxWidth: '90%' },
  heroStats: { flexDirection: 'row-reverse', alignItems: 'center', gap: 18, marginTop: 20 },
  statValue: { color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'right' },
  statLabel: { color: '#a7f3d0', fontSize: 11, marginTop: 3, textAlign: 'right' },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.22)' },
  heroDecor: { position: 'absolute', left: -16, bottom: -20, transform: [{ rotate: '-18deg' }] },
  searchBox: { height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, gap: 10, marginBottom: 22 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 0 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { textAlign: 'right', color: '#0f172a', fontSize: 18, fontWeight: '900' },
  sectionHint: { textAlign: 'right', color: '#94a3b8', fontSize: 12, marginTop: 3 },
  resultsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  resultCount: { color: '#334155', fontSize: 13, fontWeight: '800' },
  latestLabel: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  latestText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  categoryPillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  cardArt: { width: 92, height: 92, borderRadius: 28, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-8deg' }] },
  cardArtLabel: { color: '#047857', fontSize: 10, fontWeight: '800', marginTop: 5 },
  availableBadge: { position: 'absolute', top: 12, right: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 20, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6 },
  availableDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  availableText: { fontSize: 11, color: '#047857', fontWeight: '800' },
  categoriesRow: { flexDirection: 'row-reverse', gap: 10, paddingBottom: 4, marginBottom: 20 },
  categoryPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  listContainer: { gap: 14, paddingBottom: 8 },
  cardActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  detailsButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, paddingVertical: 7 },
  detailsText: { color: '#047857', fontSize: 13, fontWeight: '900' },
  shareButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  shareText: { color: '#059669', fontSize: 12, fontWeight: '900' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  cardImagePlaceholder: {
    height: 155,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  priceTag: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  priceText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
  },
  itemDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 16,
  },
  providerInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
  providerMeta: {
    flex: 1,
    alignItems: 'flex-start',
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  districtText: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 4,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  }
});
