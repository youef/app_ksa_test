import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowDownAZ, ArrowUpLeft, BriefcaseBusiness, ChevronLeft, MapPin, Search, ShieldCheck, SlidersHorizontal, Store, Wrench, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisSurface, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { AppHeader } from '@/components/shared/AppHeader';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { getActiveLocation, isAllKingdom, subscribeLocation } from '@/lib/locationSync';
import { useBottomNavInset } from '@/lib/bottomNav';
import { DirectoryKind, DirectorySort, fetchDirectoryPage } from '@/lib/directoryPresentation';

type Entry = { id: string; kind: 'business' | 'service'; name: string; description: string; city: string; district: string; image?: string; is_verified: boolean; subcategory?: string; created_at: string };
export default function Directory() {
  useTheme();
  const c = OASIS.colors, bottom = useBottomNavInset(24);
  const [items, setItems] = useState<Entry[]>([]), [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [kind, setKind] = useState<DirectoryKind>('all'), [sort, setSort] = useState<DirectorySort>('recent'), [verified, setVerified] = useState(false);
  const [location, setLocation] = useState({ city: 'كل المدن', district: 'كل الأحياء' }), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [moreBusy, setMoreBusy] = useState(false), [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(''), [canManage, setCanManage] = useState(false);
  const request = useRef(0), page = useRef(0), moreLock = useRef(false);

  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => subscribeLocation(() => setRevision(value => value + 1)), []);
  useEffect(() => { let active = true; void supabase.rpc('hayna_my_account_capabilities').then(({ data }) => { if (active) setCanManage(data?.can_manage_business === true); }); return () => { active = false; }; }, []);

  const load = useCallback(async (append = false, refresh = false) => {
    if (append && moreLock.current) return;
    const ticket = append ? request.current : ++request.current;
    const targetPage = append ? page.current + 1 : 0;
    if (append) { moreLock.current = true; setMoreBusy(true); }
    else { moreLock.current = false; setMoreBusy(false); setRefreshing(refresh); setLoading(!refresh); if (!refresh) { setItems([]); setHasMore(false); } }
    setError('');
    try {
      const loc = await getActiveLocation();
      if (ticket !== request.current) return;
      setLocation(loc);
      const result = await fetchDirectoryPage(supabase, { location: loc, kind, search, verified, sort, page: targetPage });
      if (ticket !== request.current) return;
      setItems(previous => {
        const merged = append ? [...previous, ...result.items] : result.items;
        return merged.filter((item, index) => merged.findIndex(other => other.id === item.id && other.kind === item.kind) === index).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ar') || a.id.localeCompare(b.id) : b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
      });
      page.current = targetPage; setHasMore(result.hasMore);
    } catch {
      if (ticket === request.current) setError('تعذر تحميل النتائج. تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      if (ticket === request.current) { setLoading(false); setRefreshing(false); setMoreBusy(false); moreLock.current = false; }
    }
  }, [kind, search, verified, sort, revision]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; moreLock.current = false; }; }, [load]));
  const reset = () => { setQuery(''); setKind('all'); setVerified(false); setSort('recent'); };
  const locationLabel = isAllKingdom(location.city) ? 'كل المملكة' : [location.district && location.district !== 'كل الأحياء' ? 'حي ' + location.district : null, location.city].filter(Boolean).join(' · ');
  return <View style={s.screen}>
    <AppHeader variant="sub" title="دليل الحي" subtitle={locationLabel} fallbackRoute="/more" />
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[s.page, { paddingBottom: bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(false, true)} tintColor={c.primary} />}>
      <OasisSurface oasisSurface="card" style={[s.intro, { borderColor: c.line }]}>
        <View style={[s.introIcon, { backgroundColor: c.soft }]}><BriefcaseBusiness size={25} color={c.primary} /></View>
        <View style={s.grow}><Text style={[s.introTitle, { color: c.ink }]}>أعمال قريبة، وخيارات أوضح</Text><Text style={[s.secondary, { color: c.muted }]}>اكتشف المنشآت والخدمات المعتمدة في نطاق تصفحك.</Text></View>
      </OasisSurface>
      <OasisSurface oasisSurface="field" style={[s.search, { borderColor: c.line }]}>
        <Search size={20} color={c.primary} />
        <TextInput accessibilityLabel="البحث في دليل الحي" value={query} onChangeText={setQuery} maxLength={80} placeholder="اسم المنشأة أو الخدمة…" style={[s.input, { color: c.ink }]} returnKeyType="search" />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setQuery('')} style={s.clear}><X size={18} color={c.muted} /></Pressable>}
      </OasisSurface>
      <View style={[s.segment, { backgroundColor: c.surface, borderColor: c.line }]}>
        {([{ value: 'all', title: 'الكل', Icon: BriefcaseBusiness }, { value: 'business', title: 'المنشآت', Icon: Store }, { value: 'service', title: 'الخدمات', Icon: Wrench }] as const).map(({ value, title, Icon }) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={[s.segmentButton, kind === value && { backgroundColor: c.primary }]}><Icon size={16} color={kind === value ? '#fff' : c.muted} /><Text style={[s.chipText, { color: kind === value ? '#fff' : c.muted }]}>{title}</Text></Pressable>)}
      </View>
      <View style={s.row}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: verified }} onPress={() => setVerified(value => !value)} style={[s.chip, { backgroundColor: verified ? c.soft : c.surface, borderColor: verified ? c.primary : c.line }]}><ShieldCheck size={16} color={verified ? c.primary : c.muted} /><Text style={[s.chipText, { color: verified ? c.primary : c.muted }]}>الموثّقة فقط</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={sort === 'recent' ? 'الترتيب الحالي الأحدث، التغيير إلى أبجدي' : 'الترتيب الحالي أبجدي، التغيير إلى الأحدث'} onPress={() => setSort(value => value === 'recent' ? 'name' : 'recent')} style={[s.chip, { backgroundColor: c.surface, borderColor: c.line }]}><ArrowDownAZ size={16} color={c.muted} /><Text style={[s.chipText, { color: c.muted }]}>{sort === 'recent' ? 'الأحدث' : 'أبجديًا'}</Text></Pressable>
      </View>
      <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={[s.resultTitle, { color: c.ink }]}>{loading ? 'نبحث في نطاقك…' : items.length.toLocaleString('ar-SA') + ' نتيجة معروضة'}</Text>{(search || kind !== 'all' || verified) && <Pressable accessibilityRole="button" onPress={reset}><Text style={{ color: c.primary, fontSize: 12 }}>إعادة الضبط</Text></Pressable>}</View>
      {loading ? <View style={s.state}><ActivityIndicator color={c.primary} size="large" /><Text style={[s.secondary, { color: c.muted }]}>جارٍ تحميل دليل الحي…</Text></View> : <>
        {items.map(item => <DirectoryCard key={item.kind + item.id} item={item} />)}
        {!!error && <OasisSurface oasisSurface="card" style={s.state}><Text style={[s.secondary, { color: c.muted }]}>{error}</Text><Pressable style={[s.action, { backgroundColor: c.primary }]} onPress={() => void load(items.length > 0)}><Text style={s.white}>إعادة المحاولة</Text></Pressable></OasisSurface>}
        {!items.length && !error && <OasisSurface oasisSurface="card" style={s.state}><SlidersHorizontal size={32} color={c.primary} /><Text style={[s.introTitle, { color: c.ink }]}>لم نعثر على نتائج مطابقة</Text><Text style={[s.secondary, { color: c.muted }]}>جرّب اسمًا آخر أو خفّف الفلاتر. لن نغيّر نطاق موقعك تلقائيًا.</Text><Pressable onPress={reset} style={[s.action, { backgroundColor: c.primary }]}><Text style={s.white}>مسح الفلاتر</Text></Pressable></OasisSurface>}
        {hasMore && !error && <Pressable disabled={moreBusy} onPress={() => void load(true)} style={[s.more, { backgroundColor: c.surface, borderColor: c.line }]}>{moreBusy ? <ActivityIndicator color={c.primary} /> : <Text style={{ color: c.primary, fontWeight: '700' }}>عرض المزيد</Text>}</Pressable>}
      </>}
      {canManage && <Pressable onPress={() => router.push('/marketplace-dashboard')} style={[s.manage, { backgroundColor: c.soft }]}><Store size={20} color={c.primary} /><View style={s.grow}><Text style={[s.resultTitle, { color: c.primary }]}>مساحة أعمالي</Text><Text style={[s.secondary, { color: c.muted }]}>إدارة المنشأة والخدمات من مكان واحد</Text></View><ArrowUpLeft size={19} color={c.primary} /></Pressable>}
    </ScrollView>
  </View>;
}
function DirectoryCard({ item }: { item: Entry }) {
  const c = OASIS.colors, [failed, setFailed] = useState(false), Icon = item.kind === 'business' ? Store : Wrench;
  return <Pressable accessibilityRole="button" accessibilityLabel={'عرض ' + item.name} onPress={() => router.push({ pathname: item.kind === 'business' ? '/business' : '/service', params: { id: item.id } })} style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}>
    <View style={[s.visual, { backgroundColor: c.soft }]}>{item.image && !failed ? <Image source={{ uri: item.image }} style={s.image} resizeMode={item.kind === 'business' ? 'contain' : 'cover'} onError={() => setFailed(true)} /> : <Icon size={29} color={c.primary} />}</View>
    <View style={s.grow}>
      <View style={s.row}><Text style={[s.type, { color: c.primary }]}>{item.kind === 'business' ? 'منشأة' : item.subcategory || 'خدمة'}</Text>{item.is_verified && <View accessibilityLabel="موثقة" style={s.row}><ShieldCheck size={13} color={c.primary} /><Text style={[s.type, { color: c.primary }]}>موثّقة</Text></View>}</View>
      <Text numberOfLines={2} style={[s.cardTitle, { color: c.ink }]}>{item.name}</Text>
      {!!item.description && <Text numberOfLines={2} style={[s.secondary, { color: c.muted }]}>{item.description}</Text>}
      <View style={s.row}><MapPin size={12} color={c.muted} /><Text numberOfLines={1} style={[s.area, { color: c.muted }]}>{[item.district && 'حي ' + item.district, item.city].filter(Boolean).join(' · ') || 'العنوان العام غير مضاف'}</Text></View>
    </View><ChevronLeft size={19} color={c.muted} />
  </Pressable>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' }, page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, gap: 12 },
  intro: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, borderWidth: 1 }, introIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, minWidth: 0, gap: 6 }, introTitle: { fontSize: 17, lineHeight: 25, fontWeight: '800', textAlign: 'right' }, secondary: { fontSize: 12, lineHeight: 20, textAlign: 'right' },
  search: { minHeight: 52, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, input: { flex: 1, fontSize: 14, textAlign: 'right', paddingVertical: 12 }, clear: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row-reverse', borderWidth: 1, borderRadius: 18, padding: 4, gap: 4 }, segmentButton: { flex: 1, minHeight: 44, borderRadius: 14, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, chip: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 42, gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13 }, chipText: { fontSize: 12, fontWeight: '700' },
  resultTitle: { fontSize: 14, fontWeight: '700', textAlign: 'right' }, card: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1, borderRadius: 22 }, visual: { width: 76, height: 82, borderRadius: 17, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, image: { width: '100%', height: '100%' }, type: { fontSize: 10, fontWeight: '700' }, cardTitle: { fontSize: 15, lineHeight: 23, fontWeight: '800', textAlign: 'right' }, area: { flex: 1, fontSize: 10, textAlign: 'right' },
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, borderRadius: 22 }, action: { minHeight: 44, paddingHorizontal: 20, borderRadius: 14, justifyContent: 'center' }, white: { color: '#fff', fontWeight: '700' }, more: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, manage: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, marginTop: 8 },
});
