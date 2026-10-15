import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Bookmark, Heart, Trash2, Search, Store, BriefcaseBusiness, MessageCircle, Package, ChevronLeft, RefreshCw, Sparkles, CalendarDays, Inbox, LogIn } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type FavoriteItem = { id: string; target_type: string; target_id: string; created_at: string };
type Filter = 'all' | 'market' | 'service' | 'other';

const typeMeta = (raw: string) => {
  const value = (raw || '').toLowerCase();
  if (value.includes('market') || value.includes('product') || value.includes('listing') || value.includes('item')) return { label: 'سوق الحي', icon: Package, color: '#B45309', tint: '#FEF3C7', filter: 'market' as Filter };
  if (value.includes('service') || value.includes('provider') || value.includes('business') || value.includes('merchant')) return { label: 'خدمة أو نشاط', icon: Store, color: '#047857', tint: '#D1FAE5', filter: 'service' as Filter };
  if (value.includes('request') || value.includes('question') || value.includes('post')) return { label: 'مجتمع الحي', icon: MessageCircle, color: '#2563EB', tint: '#DBEAFE', filter: 'other' as Filter };
  return { label: raw || 'عنصر محفوظ', icon: Bookmark, color: '#6D28D9', tint: '#EDE9FE', filter: 'other' as Filter };
};

const shortId = (value: string) => value ? value.replace(/-/g, '').slice(0, 8).toUpperCase() : '—';

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
      setItems((data || []) as FavoriteItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل العناصر المحفوظة.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const meta = typeMeta(item.target_type);
      const matchesFilter = filter === 'all' || meta.filter === filter;
      const matchesSearch = !q || [meta.label, item.target_type, item.target_id].some((v) => v.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [items, query, filter]);

  const remove = (item: FavoriteItem) => {
    Alert.alert('إزالة من المفضلة', 'هل تريد إزالة هذا العنصر من قائمتك المحفوظة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: async () => {
        const previous = items;
        setItems((rows) => rows.filter((row) => row.id !== item.id));
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { setItems(previous); return; }
        const { error: deleteError } = await supabase.from('favorite_items').delete().eq('id', item.id).eq('user_id', auth.user.id);
        if (deleteError) { setItems(previous); Alert.alert('تعذرت الإزالة', deleteError.message); }
      } },
    ]);
  };

  const countMarket = items.filter((i) => typeMeta(i.target_type).filter === 'market').length;
  const countServices = items.filter((i) => typeMeta(i.target_type).filter === 'service').length;

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="المفضلة" subtitle="كل ما تريد الرجوع إليه لاحقًا" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}>
        <LinearGradient colors={['#312E81','#5B21B6','#7C3AED']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><Heart size={24} color="#F5D0FE" fill="#F5D0FE"/></View><View style={styles.heroBadge}><Sparkles size={12} color="#E9D5FF"/><Text style={styles.heroBadgeText}>مساحتك الخاصة</Text></View></View>
          <Text style={styles.heroTitle}>محفوظاتك في مكان واحد</Text>
          <Text style={styles.heroDesc}>احتفظ بالعناصر المهمة وارجع إليها بسهولة متى احتجت.</Text>
          <View style={styles.statsRow}><Stat value={String(items.length)} label="إجمالي المحفوظات"/><View style={styles.statDivider}/><Stat value={String(countMarket)} label="من سوق الحي"/><View style={styles.statDivider}/><Stat value={String(countServices)} label="خدمات وأنشطة"/></View>
        </LinearGradient>

        <View style={styles.searchBox}><Search size={18} color="#94A3B8"/><TextInput value={query} onChangeText={setQuery} placeholder="ابحث في المحفوظات..." placeholderTextColor="#94A3B8" style={styles.searchInput}/><Pressable onPress={() => void load(true)} style={styles.refreshButton}><RefreshCw size={15} color="#475569"/></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {([{key:'all',label:'الكل',count:items.length},{key:'market',label:'سوق الحي',count:countMarket},{key:'service',label:'الخدمات',count:countServices},{key:'other',label:'أخرى',count:items.length-countMarket-countServices}] as {key:Filter;label:string;count:number}[]).map((f) => <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterChip,filter===f.key&&styles.filterChipActive]}><Text style={[styles.filterText,filter===f.key&&styles.filterTextActive]}>{f.label}</Text><View style={[styles.filterCount,filter===f.key&&styles.filterCountActive]}><Text style={[styles.filterCountText,filter===f.key&&styles.filterCountTextActive]}>{f.count}</Text></View></Pressable>)}
        </ScrollView>

        {loading ? <View style={styles.stateCard}><ActivityIndicator size="large" color="#6D28D9"/><Text style={styles.stateTitle}>جارٍ ترتيب محفوظاتك</Text><Text style={styles.stateDesc}>لحظات ونجهز قائمتك.</Text></View> :
          !signedIn ? <View style={styles.stateCard}><View style={styles.stateIcon}><LogIn size={25} color="#6D28D9"/></View><Text style={styles.stateTitle}>سجّل الدخول لعرض المفضلة</Text><Text style={styles.stateDesc}>تُحفظ العناصر على حسابك حتى تتمكن من الرجوع إليها لاحقًا.</Text><Pressable onPress={() => router.push('/auth')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>تسجيل الدخول</Text><ChevronLeft size={16} color="#fff"/></Pressable></View> :
          error ? <View style={styles.stateCard}><Text style={styles.stateTitle}>تعذر تحميل القائمة</Text><Text style={styles.stateDesc}>{error}</Text><Pressable onPress={() => void load()} style={styles.outlineButton}><RefreshCw size={15} color="#6D28D9"/><Text style={styles.outlineText}>إعادة المحاولة</Text></Pressable></View> :
          visible.length ? <View style={styles.listWrap}>{visible.map((item) => {
            const meta = typeMeta(item.target_type); const Icon = meta.icon;
            return <View key={item.id} style={styles.itemCard}>
              <View style={[styles.itemIcon,{backgroundColor:meta.tint}]}><Icon size={21} color={meta.color}/></View>
              <View style={styles.itemMain}>
                <View style={styles.itemTitleRow}><Text style={styles.itemTitle}>{meta.label}</Text><View style={[styles.typePill,{backgroundColor:meta.tint}]}><Text style={[styles.typePillText,{color:meta.color}]}>{item.target_type}</Text></View></View>
                <Text style={styles.itemId}>معرّف العنصر · {shortId(item.target_id)}</Text>
                <View style={styles.dateRow}><CalendarDays size={12} color="#94A3B8"/><Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'})}</Text></View>
              </View>
              <Pressable onPress={() => remove(item)} accessibilityRole="button" accessibilityLabel="إزالة من المفضلة" style={styles.removeButton}><Trash2 size={17} color="#DC2626"/></Pressable>
            </View>;
          })}</View> :
          <View style={styles.stateCard}><View style={styles.stateIcon}><Inbox size={26} color="#94A3B8"/></View><Text style={styles.stateTitle}>{items.length ? 'لا توجد نتائج مطابقة' : 'قائمتك ما زالت فارغة'}</Text><Text style={styles.stateDesc}>{items.length ? 'جرّب تغيير كلمة البحث أو نوع العناصر.' : 'عندما تحفظ متجرًا أو خدمة أو عنصرًا، ستجده هنا.'}</Text>{!items.length && <View style={styles.emptyActions}><Pressable onPress={() => router.push('/market')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>اكتشف سوق الحي</Text><ChevronLeft size={15} color="#fff"/></Pressable><Pressable onPress={() => router.push('/directory')} style={styles.outlineButton}><Text style={styles.outlineText}>تصفح دليل الخدمات</Text></Pressable></View>}</View>
        }
        <View style={styles.privacyNote}><Bookmark size={15} color="#6D28D9"/><Text style={styles.privacyText}>هذه القائمة خاصة بحسابك ولا تظهر للمستخدمين الآخرين.</Text></View>
      </ScrollView>
    </View>
  );
}

function Stat({value,label}:{value:string;label:string}) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},content:{padding:16,gap:13},
  hero:{borderRadius:25,padding:18,gap:12},heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},heroIcon:{width:48,height:48,borderRadius:16,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},heroBadge:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.12)',paddingHorizontal:9,paddingVertical:6,borderRadius:30},heroBadgeText:{fontSize:10,fontWeight:'900',color:'#E9D5FF'},heroTitle:{fontSize:22,fontWeight:'900',color:'#fff',textAlign:'right'},heroDesc:{fontSize:12,color:'#EDE9FE',lineHeight:20,textAlign:'right'},
  statsRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',marginTop:4},stat:{flex:1,alignItems:'center',gap:4},statValue:{fontSize:20,fontWeight:'900',color:'#fff'},statLabel:{fontSize:9.5,color:'#E9D5FF',fontWeight:'700',textAlign:'center'},statDivider:{width:1,height:30,backgroundColor:'rgba(255,255,255,0.22)'},
  searchBox:{flexDirection:'row-reverse',alignItems:'center',gap:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:15,paddingHorizontal:12},searchInput:{flex:1,paddingVertical:12,fontSize:12,color:'#0F172A',textAlign:'right'},refreshButton:{width:31,height:31,borderRadius:10,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  filters:{gap:8,paddingVertical:2},filterChip:{flexDirection:'row-reverse',alignItems:'center',gap:7,paddingHorizontal:11,paddingVertical:8,borderRadius:30,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#fff'},filterChipActive:{backgroundColor:'#6D28D9',borderColor:'#6D28D9'},filterText:{fontSize:11,fontWeight:'800',color:'#64748B'},filterTextActive:{color:'#fff'},filterCount:{minWidth:20,height:20,borderRadius:10,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center',paddingHorizontal:4},filterCountActive:{backgroundColor:'rgba(255,255,255,0.18)'},filterCountText:{fontSize:9,fontWeight:'900',color:'#64748B'},filterCountTextActive:{color:'#fff'},
  listWrap:{gap:9},itemCard:{flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:17,padding:12},itemIcon:{width:45,height:45,borderRadius:14,alignItems:'center',justifyContent:'center'},itemMain:{flex:1,gap:5},itemTitleRow:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:6},itemTitle:{fontSize:12.5,fontWeight:'900',color:'#0F172A'},typePill:{paddingHorizontal:7,paddingVertical:3,borderRadius:6},typePillText:{fontSize:9,fontWeight:'900'},itemId:{fontSize:10.5,color:'#64748B',textAlign:'right'},dateRow:{flexDirection:'row-reverse',alignItems:'center',gap:5},itemDate:{fontSize:10,color:'#94A3B8'},removeButton:{width:35,height:35,borderRadius:11,backgroundColor:'#FEF2F2',alignItems:'center',justifyContent:'center'},
  stateCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:20,padding:22,alignItems:'center',gap:9},stateIcon:{width:52,height:52,borderRadius:17,backgroundColor:'#F5F3FF',alignItems:'center',justifyContent:'center'},stateTitle:{fontSize:14,fontWeight:'900',color:'#0F172A',textAlign:'center'},stateDesc:{fontSize:11.5,color:'#64748B',textAlign:'center',lineHeight:19},primaryButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:'#6D28D9',paddingHorizontal:15,paddingVertical:11,borderRadius:12},primaryButtonText:{fontSize:11.5,fontWeight:'900',color:'#fff'},outlineButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,borderWidth:1,borderColor:'#DDD6FE',backgroundColor:'#FAF5FF',paddingHorizontal:14,paddingVertical:10,borderRadius:12},outlineText:{fontSize:11,fontWeight:'900',color:'#6D28D9'},emptyActions:{flexDirection:'row-reverse',flexWrap:'wrap',justifyContent:'center',gap:8,marginTop:4},privacyNote:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:8},privacyText:{fontSize:10,color:'#64748B',textAlign:'center'},
});
