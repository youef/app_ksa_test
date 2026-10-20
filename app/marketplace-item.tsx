import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, MapPin, Package, Share2, ShoppingBag, UserRound } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function MarketplaceItemPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const [item, setItem] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) { setLoading(false); setError(true); return; }
    setLoading(true); setError(false);
    try {
      const { data, error: itemError } = await supabase
        .from('marketplace_items')
        .select('id,seller_id,title,description,price,item_type,city,district,image_url,status,created_at')
        .eq('id', itemId)
        .maybeSingle();
      if (itemError) throw itemError;
      if (!data) { setItem(null); return; }
      setItem(data);
      if (data.seller_id) {
        const { data: profile } = await supabase.from('profiles')
          .select('id,username,display_name,avatar_url,is_verified,city,district')
          .eq('id', data.seller_id).maybeSingle();
        setSeller(profile || null);
      }
    } catch (e) {
      console.error('marketplace item load', e);
      setError(true);
    } finally { setLoading(false); }
  }, [itemId]);

  useEffect(() => { void load(); }, [load]);

  const share = async () => {
    if (!item) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try { await Share.share({ title: item.title || 'إعلان من سوق حيّنا', message: [item.title, item.description, url].filter(Boolean).join('\n') }); } catch {}
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /><Text style={styles.muted}>جارٍ تحميل الإعلان...</Text></View>;
  if (error || !item) return <View style={styles.center}><Package size={42} color="#94a3b8" /><Text style={styles.title}>{error ? 'تعذّر تحميل الإعلان' : 'الإعلان غير موجود'}</Text><Text style={styles.muted}>قد يكون الإعلان حُذف أو لم يعد متاحاً.</Text><Pressable style={styles.primary} onPress={() => error ? void load() : router.back()}><Text style={styles.primaryText}>{error ? 'إعادة المحاولة' : 'رجوع'}</Text></Pressable></View>;

  return <View style={styles.screen}>
    <AppHeader variant="sub" title="تفاصيل الإعلان" fallbackRoute="/user" rightAction={<HeaderAction onPress={share} accessibilityRole="button" accessibilityLabel="مشاركة الإعلان" style={styles.share}><Share2 size={18} color="#047857" /></HeaderAction>} />
    <ScrollView contentContainerStyle={styles.page}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" /> : <View style={styles.imageFallback}><ShoppingBag size={42} color="#059669" /><Text style={styles.muted}>إعلان من سوق الحي</Text></View>}
      <View style={styles.card}>
        <View style={styles.row}><View style={styles.typePill}><Text style={styles.typeText}>{item.item_type || 'إعلان'}</Text></View><Text style={styles.status}>{item.status === 'sold' ? 'تم البيع' : item.status === 'inactive' ? 'غير متاح' : 'معروض'}</Text></View>
        <Text style={styles.title}>{item.title || 'إعلان بدون عنوان'}</Text>
        <Text style={styles.price}>{item.price != null ? `${Number(item.price).toLocaleString('ar-SA')} ر.س` : 'السعر بالتواصل'}</Text>
        {!!item.description && <Text style={styles.description}>{item.description}</Text>}
        {(item.city || item.district) && <View style={styles.location}><MapPin size={16} color="#64748b" /><Text style={styles.muted}>{[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}</Text></View>}
      </View>
      {seller && <Pressable style={styles.sellerCard} onPress={() => router.push({ pathname: '/user', params: { id: seller.id } })}>
        {seller.avatar_url ? <Image source={{ uri: seller.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><UserRound size={20} color="#047857" /></View>}
        <View style={styles.sellerCopy}><Text style={styles.sellerTitle}>{seller.display_name || seller.username || 'صاحب الإعلان'} {seller.is_verified ? '✓' : ''}</Text><Text style={styles.muted}>عرض الملف الشخصي للبائع</Text></View>
        <ArrowUpRight size={18} color="#059669" />
      </Pressable>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f8fafc'},page:{padding:16,paddingBottom:36,gap:14,width:'100%',maxWidth:860,alignSelf:'center'},
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:24,backgroundColor:'#f8fafc'},muted:{fontSize:12,color:'#64748b',textAlign:'right',lineHeight:19},
  title:{fontSize:21,fontWeight:'900',color:'#0f172a',textAlign:'right',lineHeight:31},image:{width:'100%',height:260,borderRadius:18,backgroundColor:'#e2e8f0'},imageFallback:{height:190,borderRadius:18,backgroundColor:'#ecfdf5',alignItems:'center',justifyContent:'center',gap:8},
  card:{backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#e2e8f0',padding:18,gap:12},row:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},typePill:{backgroundColor:'#ecfdf5',paddingHorizontal:10,paddingVertical:5,borderRadius:9},typeText:{fontSize:11,fontWeight:'800',color:'#047857'},status:{fontSize:11,color:'#64748b',fontWeight:'700'},
  price:{fontSize:19,fontWeight:'900',color:'#047857',textAlign:'right'},description:{fontSize:14,lineHeight:25,color:'#334155',textAlign:'right'},location:{flexDirection:'row-reverse',alignItems:'center',gap:7,paddingTop:6},
  sellerCard:{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2e8f0'},avatar:{width:44,height:44,borderRadius:22},avatarFallback:{width:44,height:44,borderRadius:22,backgroundColor:'#ecfdf5',alignItems:'center',justifyContent:'center'},sellerCopy:{flex:1,gap:4},sellerTitle:{fontSize:14,fontWeight:'900',color:'#0f172a',textAlign:'right'},share:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'#ecfdf5'},primary:{paddingHorizontal:20,paddingVertical:12,borderRadius:12,backgroundColor:'#059669'},primaryText:{color:'#fff',fontWeight:'900'}
});
