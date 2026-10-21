import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  BriefcaseBusiness,
  ChevronLeft,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
} from 'lucide-react-native';

import { AppHeader } from '@/components/shared/AppHeader';
import { AccountIdentityBadge, AccountVerificationBadge } from '@/components/profile/AccountIdentityBadge';
import { supabase } from '@/lib/supabase';
import { getActiveLocation, isAllKingdom, isLocationMatching } from '@/lib/locationSync';

type DirectoryItem = {
  id: string;
  type: 'business' | 'service';
  title: string;
  description: string;
  city?: string | null;
  district?: string | null;
  image?: string | null;
  ownerId?: string | null;
  owner?: any;
  verified?: boolean;
  category?: string | null;
  businessName?: string | null;
};

export default function Directory() {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'business' | 'service'>('all');
  const [location, setLocation] = useState({ region: 'كل المملكة', city: 'كل المدن', district: 'كل الأحياء' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const [loc, businessesRes, servicesRes] = await Promise.all([
        getActiveLocation(),
        supabase
          .from('businesses')
          .select('id,owner_id,name,description,city,district,logo_url,cover_url,is_verified,moderation_status,owner:owner_id(id,display_name,username,avatar_url,is_verified,account_type,freelance_trade)')
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('services')
          .select('id,provider_id,business_id,name,description,city,district,cover_url,category,subcategory,is_verified,moderation_status,provider:provider_id(id,display_name,username,avatar_url,is_verified,account_type,freelance_trade),business:business_id(id,name,is_verified)')
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      setLocation(loc);

      if (businessesRes.error) throw businessesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      const businesses: DirectoryItem[] = (businessesRes.data || []).map((row: any) => ({
        id: row.id,
        type: 'business',
        title: row.name,
        description: row.description || 'منشأة محلية في مجتمع حيّنا',
        city: row.city,
        district: row.district,
        image: row.logo_url || row.cover_url,
        ownerId: row.owner_id,
        owner: row.owner,
        verified: Boolean(row.is_verified),
        businessName: row.name,
      }));

      const services: DirectoryItem[] = (servicesRes.data || []).map((row: any) => ({
        id: row.id,
        type: 'service',
        title: row.name,
        description: row.description || row.subcategory || row.category || 'خدمة محلية',
        city: row.city,
        district: row.district,
        image: row.cover_url,
        ownerId: row.provider_id,
        owner: row.provider,
        verified: Boolean(row.provider?.is_verified || row.is_verified),
        category: row.subcategory || row.category,
        businessName: row.business?.name || null,
      }));

      setItems([...businesses, ...services]);
    } catch (e) {
      console.warn('directory load', e);
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ar');
    return items.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      const locationMatch = isAllKingdom(location.city) || isLocationMatching(item, location.city, location.district);
      if (!locationMatch) return false;
      if (!q) return true;
      return [item.title, item.description, item.category, item.businessName, item.owner?.display_name, item.city, item.district]
        .some((value) => String(value || '').toLocaleLowerCase('ar').includes(q));
    });
  }, [items, filter, location, query]);

  const locationLabel = isAllKingdom(location.city)
    ? 'كل المملكة'
    : location.city + (location.district && location.district !== 'كل الأحياء' ? ' · حي ' + location.district : '');

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="دليل الأعمال" subtitle={locationLabel} fallbackRoute="/more" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor="#059669" />}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrap}>
          <Search size={17} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن منشأة أو خدمة"
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            textAlign="right"
          />
        </View>

        <View style={styles.filters}>
          <Filter active={filter === 'all'} label={'الكل ' + filtered.length} onPress={() => setFilter('all')} />
          <Filter active={filter === 'business'} label="المنشآت" onPress={() => setFilter('business')} />
          <Filter active={filter === 'service'} label="الخدمات" onPress={() => setFilter('service')} />
        </View>

        <View style={styles.notice}>
          <ShieldCheck size={17} color="#047857" />
          <Text style={styles.noticeText}>هذا الدليل يعرض بيانات حقيقية من حيّنا فقط. إدارة النشاط والإضافة تتم من «حسابي».</Text>
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color="#059669" /><Text style={styles.stateText}>جاري تحميل الدليل...</Text></View>
        ) : error ? (
          <View style={styles.state}><Text style={styles.stateTitle}>تعذر تحميل الدليل</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
        ) : filtered.length ? (
          <View style={styles.list}>
            {filtered.map((item) => <DirectoryRow key={item.type + ':' + item.id} item={item} />)}
          </View>
        ) : (
          <View style={styles.state}>
            <BriefcaseBusiness size={34} color="#94A3B8" />
            <Text style={styles.stateTitle}>لا توجد نتائج حاليًا</Text>
            <Text style={styles.stateText}>ستظهر المنشآت والخدمات المعتمدة في هذا النطاق هنا.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DirectoryRow({ item }: { item: DirectoryItem }) {
  const Icon = item.type === 'business' ? Store : Wrench;
  const open = () => {
    if (item.type === 'business') router.push({ pathname: '/business', params: { id: item.id } });
    else router.push({ pathname: '/service', params: { id: item.id } });
  };

  return (
    <Pressable style={styles.row} onPress={open}>
      <View style={styles.visual}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : <Icon size={22} color="#0F766E" />}
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {item.verified ? <ShieldCheck size={13} color="#059669" /> : null}
        </View>
        {item.businessName && item.type === 'service' ? <Text style={styles.businessName}>{item.businessName}</Text> : null}
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.meta}>
          <MapPin size={11} color="#94A3B8" />
          <Text style={styles.metaText}>{[item.district && 'حي ' + item.district, item.city].filter(Boolean).join(' · ') || 'الموقع غير محدد'}</Text>
        </View>
        {item.owner ? (
          <Pressable
            style={styles.ownerLine}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              item.ownerId && router.push({ pathname: '/user', params: { id: item.ownerId } });
            }}
          >
            <View style={styles.ownerAvatar}>
              {item.owner.avatar_url ? <Image source={{ uri: item.owner.avatar_url }} style={styles.image} /> : <UserRound size={13} color="#64748B" />}
            </View>
            <Text style={styles.ownerName}>{item.owner.display_name || item.owner.username}</Text>
            <AccountIdentityBadge role={item.owner.role} accountType={item.owner.account_type} isVerified={Boolean(item.owner.is_verified)} compact />
            <AccountVerificationBadge role={item.owner.role} accountType={item.owner.account_type} isVerified={Boolean(item.owner.is_verified)} compact />
          </Pressable>
        ) : null}
      </View>
      <ChevronLeft size={18} color="#CBD5E1" />
    </Pressable>
  );
}

function Filter({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  page: { padding: 14, paddingBottom: 36, gap: 12, maxWidth: 820, width: '100%', alignSelf: 'center' },
  searchWrap: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#0F172A', fontSize: 12, fontWeight: '700' },
  filters: { flexDirection: 'row-reverse', gap: 7 },
  filter: { borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 7 },
  filterActive: { backgroundColor: '#0F766E' },
  filterText: { color: '#64748B', fontSize: 10.5, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  notice: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, backgroundColor: '#ECFDF5', borderRadius: 13, padding: 10, borderWidth: 1, borderColor: '#D1FAE5' },
  noticeText: { flex: 1, color: '#065F46', fontSize: 9.5, lineHeight: 16, fontWeight: '700', textAlign: 'right' },
  list: { gap: 8 },
  row: { minHeight: 112, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  visual: { width: 66, height: 66, borderRadius: 15, backgroundColor: '#F0FDF4', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  copy: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, width: '100%' },
  title: { flex: 1, color: '#0F172A', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  businessName: { color: '#047857', fontSize: 9.5, fontWeight: '800', marginTop: 2 },
  description: { color: '#64748B', fontSize: 10, lineHeight: 15, textAlign: 'right', marginTop: 3 },
  meta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 5 },
  metaText: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  ownerLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6, maxWidth: '100%' },
  ownerAvatar: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#F1F5F9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ownerName: { color: '#475569', fontSize: 9, fontWeight: '800', maxWidth: 100 },
  state: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateTitle: { color: '#334155', fontSize: 14, fontWeight: '900' },
  stateText: { color: '#94A3B8', fontSize: 10.5, textAlign: 'center', lineHeight: 17 },
  retry: { backgroundColor: '#0F766E', borderRadius: 11, paddingHorizontal: 15, paddingVertical: 9 },
  retryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
});
