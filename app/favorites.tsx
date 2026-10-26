import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Bookmark, Heart, Trash2, Search, Store, MessageCircle, Package, ChevronLeft, RefreshCw, Sparkles, CalendarDays, Inbox, LogIn, MapPin, Image as ImageIcon, Tag, CircleCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Filter = 'all' | 'market' | 'questions' | 'requests' | 'stores';
type FavoriteItem = {
  id: string;
  target_type: string;
  target_id: string;
  created_at: string;
  title?: string;
  body?: string;
  city?: string;
  district?: string | null;
  resolution_status?: string;
  imageUrl?: string | null;
  priceLabel?: string | null;
  subtitle?: string | null;
  route?: any;
};

const typeMeta = (raw: string) => {
  const value = (raw || '').toLowerCase();
  if (value === 'product' || value === 'service') return { label: value === 'product' ? 'منتج' : 'خدمة', icon: Package, color: '#B45309', tint: '#FEF3C7', filter: 'market' as Filter };
  if (value === 'store' || value === 'business') return { label: 'متجر أو نشاط', icon: Store, color: OASIS.colors.primary, tint: OASIS.colors.soft, filter: 'stores' as Filter };
  if (value === 'question' || value === 'post') return { label: 'استفسار مجتمعي', icon: MessageCircle, color: '#2563EB', tint: '#DBEAFE', filter: 'questions' as Filter };
  if (value === 'request') return { label: 'طلب مساعدة', icon: Heart, color: '#BE185D', tint: '#FCE7F3', filter: 'requests' as Filter };
  return { label: 'عنصر محفوظ', icon: Bookmark, color: '#6D28D9', tint: '#EDE9FE', filter: 'all' as Filter };
};

function imageFrom(row: any): string | null {
  if (!row) return null;
  const candidates = [row.image_url, row.image, row.photo_url, row.cover_url, row.thumbnail_url, row.avatar_url, row.logo_url, row.imageUrl];
  for (const value of candidates) {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
  }
  const collections = [row.images, row.image_urls, row.photos, row.attachments, row.media];
  for (const collection of collections) {
    if (Array.isArray(collection)) {
      const first = collection.find((entry: any) => typeof entry === 'string' ? /^https?:\/\//i.test(entry) : typeof entry?.url === 'string' && /^https?:\/\//i.test(entry.url));
      if (typeof first === 'string') return first;
      if (first?.url) return first.url;
    }
  }
  return null;
}

function statusLabel(status?: string) {
  const labels: Record<string, string> = { open: 'مفتوح', found: 'تم العثور', helped: 'تمت المساعدة', resolved: 'تم الحل', not_needed: 'لم يعد مطلوبًا', solved: 'تم الحل', closed: 'مغلق', available: 'متاح', unavailable: 'غير متاح' };
  return status ? labels[status] || '' : '';
}

function displayPrice(row: any): string | null {
  const value = row?.price ?? row?.price_amount ?? row?.sale_price ?? row?.starting_price;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(number) + ' ر.س';
}

export default function FavoritesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { setSignedIn(false); setItems([]); return; }
      setSignedIn(true);
      const { data, error: queryError } = await supabase.from('favorite_items').select('id,target_type,target_id,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(300);
      if (queryError) throw queryError;
      const rows = (data || []) as FavoriteItem[];
      const grouped: Record<string, string[]> = {};
      rows.forEach(row => { (grouped[row.target_type] ||= []).push(row.target_id); });

      const tableByType: Record<string, string> = {
        product: 'marketplace_items', service: 'services', store: 'businesses', business: 'businesses',
        request: 'requests', question: 'questions', post: 'posts',
      };
      const details = new Map<string, any>();
      await Promise.all(Object.entries(grouped).map(async ([type, ids]) => {
        const table = tableByType[type];
        if (!table || !ids.length) return;
        try {
          const db: any = supabase;
          const { data: records, error: readError } = await db.from(table).select('*').in('id', ids);
          if (readError || !records) return;
          records.forEach((row: any) => {
            const title = row.title || row.name || row.question || row.subject || (type === 'request' ? 'طلب مساعدة من الحي' : type === 'store' ? 'متجر من الحي' : type === 'product' ? 'منتج من سوق الحي' : 'استفسار من الحي');
            const body = row.description || row.body || row.content || row.details || row.notes || '';
            const route = type === 'request'
              ? { pathname: '/request', params: { id: row.id } }
              : type === 'question' || type === 'post'
              ? { pathname: '/question', params: { id: row.id } }
              : type === 'store' || type === 'business'
              ? { pathname: '/business', params: { id: row.id } }
              : type === 'product'
              ? { pathname: '/marketplace-item', params: { id: row.id } }
              : { pathname: '/service', params: { id: row.id } };
            details.set(type + ':' + row.id, {
              title, body, city: row.city || row.profiles?.city || '', district: row.district || row.profiles?.district || '',
              resolution_status: row.resolution_status || row.status || '',
              imageUrl: imageFrom(row),
              priceLabel: displayPrice(row),
              subtitle: row.category_label || row.category || row.shop_name || row.store_name || row.profiles?.display_name || null,
              route,
            });
          });
        } catch { /* Some legacy target types may point to tables not used by this deployment. */ }
      }));
      setItems(rows.map(row => ({ ...row, ...(details.get(row.target_type + ':' + row.target_id) || {}) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل العناصر المحفوظة.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ar');
    return items.filter(item => {
      const meta = typeMeta(item.target_type);
      const matchesFilter = filter === 'all' || meta.filter === filter;
      const matchesSearch = !q || [meta.label, item.title, item.body, item.city, item.district, item.subtitle].some(value => String(value || '').toLocaleLowerCase('ar').includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [items, query, filter]);

  const remove = (item: FavoriteItem) => {
    Alert.alert('إزالة من المفضلة', 'هل تريد إزالة هذا العنصر من قائمتك المحفوظة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: async () => {
        const previous = items;
        setItems(rows => rows.filter(row => row.id !== item.id));
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { setItems(previous); return; }
        const { error: deleteError } = await supabase.from('favorite_items').delete().eq('id', item.id).eq('user_id', auth.user.id);
        if (deleteError) { setItems(previous); Alert.alert('تعذرت الإزالة', 'لم نتمكن من إزالة العنصر. حاول مرة أخرى.'); }
      } },
    ]);
  };

  const countFor = (f: Filter) => f === 'all' ? items.length : items.filter(item => typeMeta(item.target_type).filter === f).length;
  const countMarket = countFor('market');
  const countQuestions = countFor('questions');
  const countRequests = countFor('requests');
  const countStores = countFor('stores');

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="المفضلة" subtitle="منتجاتك واستفساراتك وكل ما حفظته" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}>
        <LinearGradient colors={['#312E81', '#5B21B6', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><Heart size={24} color="#F5D0FE" fill="#F5D0FE" /></View>
            <View style={styles.heroBadge}><Sparkles size={12} color="#E9D5FF" /><Text style={styles.heroBadgeText}>مساحتك الخاصة</Text></View>
          </View>
          <Text style={styles.heroTitle}>كل مفضّلتك في مكان واحد</Text>
          <Text style={styles.heroDesc}>المنتجات والاستفسارات وطلبات المساعدة والمتاجر المحفوظة، مع صورها وتفاصيلها عند توفرها.</Text>
          <View style={styles.statsRow}>
            <Stat value={String(items.length)} label="إجمالي المحفوظات" />
            <View style={styles.statDivider} />
            <Stat value={String(countMarket)} label="منتجات وخدمات" />
            <View style={styles.statDivider} />
            <Stat value={String(countQuestions + countRequests)} label="استفسارات وطلبات" />
          </View>
        </LinearGradient>

        <OasisSurface oasisSurface="field" style={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالعنوان أو التفاصيل أو الحي..." placeholderTextColor="#94A3B8" style={styles.searchInput} textAlign="right" />
          <Pressable oasisKind="icon" onPress={() => void load(true)} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="تحديث المفضلة"><RefreshCw size={15} color={OASIS.colors.muted} /></Pressable>
        </OasisSurface>
        <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, { direction: 'ltr' }]}>
          {([
            { key: 'all', label: 'الكل', count: items.length },
            { key: 'market', label: 'المنتجات والخدمات', count: countMarket },
            { key: 'questions', label: 'الاستفسارات', count: countQuestions },
            { key: 'requests', label: 'طلبات المساعدة', count: countRequests },
            { key: 'stores', label: 'المتاجر', count: countStores },
          ] as { key: Filter; label: string; count: number }[]).map(f => (
            <Pressable oasisVariant={filter === f.key ? 'primary' : 'secondary'} oasisKind="chip" key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterChip, filter === f.key && styles.filterChipActive]}>
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
              <View style={[styles.filterCount, filter === f.key && styles.filterCountActive]}><Text style={[styles.filterCountText, filter === f.key && styles.filterCountTextActive]}>{f.count}</Text></View>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <OasisSurface oasisSurface="card" style={styles.stateCard}><ActivityIndicator size="large" color="#6D28D9" /><Text style={styles.stateTitle}>جارٍ تحميل مفضّلتك</Text><Text style={styles.stateDesc}>نجهّز العناصر المحفوظة وتفاصيلها.</Text></OasisSurface> :
          !signedIn ? <OasisSurface oasisSurface="card" style={styles.stateCard}><View style={styles.stateIcon}><LogIn size={25} color="#6D28D9" /></View><Text style={styles.stateTitle}>سجّل الدخول لعرض المفضلة</Text><Text style={styles.stateDesc}>ستجد هنا المنتجات والاستفسارات التي تحفظها على حسابك.</Text><Pressable oasisVariant="primary" oasisKind="action" onPress={() => router.push('/auth')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>تسجيل الدخول</Text><ChevronLeft size={16} color={OASIS.colors.surface} /></Pressable></OasisSurface> :
          error ? <OasisSurface oasisSurface="card" style={styles.stateCard}><Text style={styles.stateTitle}>تعذر تحميل المفضلة</Text><Text style={styles.stateDesc}>{error}</Text><Pressable oasisKind="action" onPress={() => void load()} style={styles.outlineButton}><RefreshCw size={15} color="#6D28D9" /><Text style={styles.outlineText}>إعادة المحاولة</Text></Pressable></OasisSurface> :
          visible.length ? <View style={styles.listWrap}>{visible.map(item => {
            const meta = typeMeta(item.target_type);
            const Icon = meta.icon;
            const state = statusLabel(item.resolution_status);
            const showImage = ['product', 'service', 'store', 'business'].includes(item.target_type);
            return (
              <OasisSurface oasisSurface="card" key={item.id} style={styles.itemCard}>
                <Pressable oasisKind="card" onPress={() => item.route && router.push(item.route)} style={styles.cardOpenArea} accessibilityRole="button" accessibilityLabel="فتح التفاصيل">
                  {showImage ? <View style={styles.imageFrame}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" /> : <View style={styles.imagePlaceholder}><ImageIcon size={24} color="#94A3B8" /><Text style={styles.noImageText}>لا توجد صورة</Text></View>}
                    <View style={[styles.imageTypeBadge, { backgroundColor: meta.tint }]}><Icon size={12} color={meta.color} /><Text style={[styles.imageTypeText, { color: meta.color }]}>{meta.label}</Text></View>
                  </View> : null}
                  <View style={styles.itemMain}>
                    {!showImage ? <View style={[styles.inlineTypeBadge, { backgroundColor: meta.tint }]}><Icon size={12} color={meta.color} /><Text style={[styles.imageTypeText, { color: meta.color }]}>{meta.label}</Text></View> : null}
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title || meta.label}</Text>
                    {item.subtitle ? <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
                    {item.body ? <Text style={styles.savedPostBody} numberOfLines={3}>{item.body}</Text> : <Text style={styles.savedPostBody} numberOfLines={2}>اضغط لعرض التفاصيل الكاملة لهذا العنصر.</Text>}
                    {item.priceLabel ? <View style={styles.priceRow}><Tag size={13} color={OASIS.colors.primary} /><Text style={styles.priceText}>{item.priceLabel}</Text></View> : null}
                    {item.city || item.district ? <View style={styles.locationRow}><MapPin size={12} color={OASIS.colors.muted} /><Text style={styles.savedPostLocation} numberOfLines={1}>{[item.district ? 'حي ' + item.district : '', item.city || ''].filter(Boolean).join('، ')}</Text></View> : null}
                    {state ? <View style={styles.statusPill}><CircleCheck size={12} color={state === 'مفتوح' || state === 'متاح' ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={styles.statusText}>{state}</Text></View> : null}
                    <View style={styles.dateRow}><CalendarDays size={12} color="#94A3B8" /><Text style={styles.itemDate}>أُضيفت للمفضلة {new Date(item.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</Text></View>
                  </View>
                </Pressable>
                <View style={styles.cardActions}>
                  <Pressable oasisKind="action" onPress={() => item.route && router.push(item.route)} style={styles.openButton}><Text style={styles.openButtonText}>عرض التفاصيل</Text><ChevronLeft size={15} color="#6D28D9" /></Pressable>
                  <Pressable oasisKind="icon" onPress={() => remove(item)} accessibilityRole="button" accessibilityLabel="إزالة من المفضلة" style={styles.removeButton}><Trash2 size={17} color={OASIS.colors.danger} /></Pressable>
                </View>
              </OasisSurface>
            );
          })}</View> :
          <OasisSurface oasisSurface="card" style={styles.stateCard}>
            <View style={styles.stateIcon}><Inbox size={26} color="#94A3B8" /></View>
            <Text style={styles.stateTitle}>{items.length ? 'لا توجد نتائج مطابقة' : 'لم تحفظ أي عناصر بعد'}</Text>
            <Text style={styles.stateDesc}>{items.length ? 'جرّب تغيير كلمة البحث أو اختيار تصنيف آخر.' : 'عندما تحفظ منتجًا أو استفسارًا أو طلب مساعدة، ستظهر تفاصيله هنا.'}</Text>
            {!items.length && <View style={styles.emptyActions}><Pressable oasisVariant="primary" oasisKind="action" onPress={() => router.push('/market')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>تصفح سوق الحي</Text><ChevronLeft size={15} color={OASIS.colors.surface} /></Pressable><Pressable oasisKind="action" onPress={() => router.push('/question')} style={styles.outlineButton}><Text style={styles.outlineText}>استكشف الاستفسارات</Text></Pressable></View>}
          </OasisSurface>
        }
        <View style={styles.privacyNote}><Bookmark size={15} color="#6D28D9" /><Text style={styles.privacyText}>قائمتك خاصة بك، ويمكنك إزالة أي عنصر منها في أي وقت.</Text></View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 14, gap: 13 },
  hero: { borderRadius: 14, padding: 18, gap: 12 },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 30 },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: '#E9D5FF' },
  heroTitle: { fontSize: 22, fontWeight: '700', color: OASIS.colors.surface, textAlign: 'right' },
  heroDesc: { fontSize: 12, color: '#EDE9FE', lineHeight: 20, textAlign: 'right' },
  statsRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: OASIS.colors.surface },
  statLabel: { fontSize: 11, color: '#E9D5FF', fontWeight: '700', textAlign: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.22)' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 15, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 12, color: OASIS.colors.ink, textAlign: 'right' },
  refreshButton: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingVertical: 2, flexDirection: 'row-reverse' },
  filterChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface },
  filterChipActive: { backgroundColor: '#6D28D9', borderColor: '#6D28D9' },
  filterText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.muted },
  filterTextActive: { color: OASIS.colors.surface },
  filterCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  filterCountText: { fontSize: 11, fontWeight: '700', color: OASIS.colors.muted },
  filterCountTextActive: { color: OASIS.colors.surface },
  listWrap: { gap: 11 },
  itemCard: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14, padding: 10, gap: 10, overflow: 'hidden' },
  cardOpenArea: { flexDirection: 'row-reverse', alignItems: 'stretch', gap: 12 },
  imageFrame: { width: 112, minHeight: 136, borderRadius: 13, overflow: 'hidden', backgroundColor: '#F1F5F9', position: 'relative' },
  itemImage: { width: '100%', height: '100%', minHeight: 136, backgroundColor: '#F1F5F9' },
  imagePlaceholder: { flex: 1, minHeight: 136, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8 },
  noImageText: { fontSize: 11, color: '#94A3B8', textAlign: 'center' },
  imageTypeBadge: { position: 'absolute', right: 5, bottom: 5, flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7 },
  imageTypeText: { fontSize: 11, fontWeight: '700' },
  inlineTypeBadge: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  itemMain: { flex: 1, minWidth: 0, gap: 6, alignItems: 'stretch', paddingVertical: 3 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', lineHeight: 20 },
  itemSubtitle: { fontSize: 11, color: '#6D28D9', textAlign: 'right', fontWeight: '600' },
  savedPostBody: { fontSize: 11, color: OASIS.colors.muted, textAlign: 'right', lineHeight: 18 },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: OASIS.colors.soft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  priceText: { fontSize: 11, color: OASIS.colors.primary, fontWeight: '700' },
  locationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  savedPostLocation: { flex: 1, fontSize: 11, color: OASIS.colors.muted, textAlign: 'right' },
  statusPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 },
  statusText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.muted },
  dateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  itemDate: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },
  cardActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 9 },
  openButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: '#F5F3FF' },
  openButtonText: { fontSize: 11, fontWeight: '700', color: '#6D28D9' },
  removeButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: OASIS.colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  stateCard: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14, padding: 14, alignItems: 'center', gap: 9 },
  stateIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'center' },
  stateDesc: { fontSize: 11.5, color: OASIS.colors.muted, textAlign: 'center', lineHeight: 19 },
  primaryButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#6D28D9', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12 },
  primaryButtonText: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.surface },
  outlineButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#FAF5FF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  outlineText: { fontSize: 11, fontWeight: '700', color: '#6D28D9' },
  emptyActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 },
  privacyNote: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 8 },
  privacyText: { fontSize: 11, color: OASIS.colors.muted, textAlign: 'center' },
});
