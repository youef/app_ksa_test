import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, MapPin, Package, Share2, ShoppingBag, UserRound } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AccountIdentityBadge } from '@/components/profile/AccountIdentityBadge';

export default function MarketplaceItemPage() {
  const params = useLocalSearchParams<{ id?: string }>();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const [item, setItem] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) { setLoading(false); setError(true); return; }
    setLoading(true); setError(false);
    try {
      const { data, error: itemError } = await supabase
        .from('marketplace_items')
        .select('id,seller_id,business_id,title,description,price,item_type,city,district,image_url,status,created_at')
        .eq('id', itemId)
        .maybeSingle();
      if (itemError) throw itemError;
      if (!data) { setItem(null); return; }
      setItem(data);
      const { data: auth } = await supabase.auth.getUser();
      setMe(auth.user?.id || null);
      if (data.business_id) {
        const { data: businessRow } = await supabase.from('businesses')
          .select('id,name,logo_url,is_verified,city,district')
          .eq('id', data.business_id).maybeSingle();
        setBusiness(businessRow || null);
      } else {
        setBusiness(null);
      }
      if (data.seller_id) {
        const { data: profile } = await supabase.from('profiles')
          .select('id,username,display_name,avatar_url,is_verified,account_type,freelance_trade,role,city,district')
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

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={OASIS.colors.primary} /><Text style={styles.muted}>جارٍ تحميل الإعلان...</Text></View>;
  if (error || !item) return <View style={styles.center}><Package size={42} color="#94a3b8" /><Text style={styles.title}>{error ? 'تعذّر تحميل الإعلان' : 'الإعلان غير موجود'}</Text><Text style={styles.muted}>قد يكون الإعلان حُذف أو لم يعد متاحاً.</Text><Pressable oasisVariant="primary" oasisKind="action" style={styles.primary} onPress={() => error ? void load() : router.back()}><Text style={styles.primaryText}>{error ? 'إعادة المحاولة' : 'رجوع'}</Text></Pressable></View>;

  return <View style={styles.screen}>
    <AppHeader variant="sub" title="تفاصيل الإعلان" fallbackRoute="/user" rightAction={<HeaderAction onPress={share} accessibilityRole="button" accessibilityLabel="مشاركة الإعلان" style={styles.share}><Share2 size={18} color={OASIS.colors.primary} /></HeaderAction>} />
    <ScrollView contentContainerStyle={styles.page}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" /> : <View style={styles.imageFallback}><ShoppingBag size={42} color={OASIS.colors.primary} /><Text style={styles.muted}>إعلان من سوق الحي</Text></View>}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.row}><View style={styles.typePill}><Text style={styles.typeText}>{item.item_type || 'إعلان'}</Text></View><Text style={styles.status}>{item.status === 'sold' ? 'تم البيع' : item.status === 'inactive' ? 'غير متاح' : 'معروض'}</Text></View>
        <Text style={styles.title}>{item.title || 'إعلان بدون عنوان'}</Text>
        <Text style={styles.price}>{item.price != null ? `${Number(item.price).toLocaleString('ar-SA')} ر.س` : 'السعر بالتواصل'}</Text>
        {!!item.description && <Text style={styles.description}>{item.description}</Text>}
        {(item.city || item.district) && <View style={styles.location}><MapPin size={16} color={OASIS.colors.muted} /><Text style={styles.muted}>{[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}</Text></View>}
      </OasisSurface>
      {business && <Pressable oasisKind="card" style={styles.sellerCard} onPress={() => router.push({ pathname: '/business', params: { id: business.id } })}>
        {business.logo_url ? <Image source={{ uri: business.logo_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><ShoppingBag size={20} color="#b7791f" /></View>}
        <View style={styles.sellerCopy}><Text style={styles.sellerTitle}>{business.name}</Text><Text style={styles.muted}>{business.is_verified ? 'منشأة موثقة في حيّنا' : 'عرض صفحة المنشأة'}</Text></View>
        <ArrowUpRight size={18} color="#b7791f" />
      </Pressable>}
      {seller && <Pressable oasisKind="card" style={styles.sellerCard} onPress={() => router.push({ pathname: '/user', params: { id: seller.id } })}>
        {seller.avatar_url ? <Image source={{ uri: seller.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><UserRound size={20} color={OASIS.colors.primary} /></View>}
        <View style={styles.sellerCopy}>
          <Text style={styles.sellerTitle}>{seller.account_type === 'merchant' && seller.freelance_trade ? seller.freelance_trade : seller.display_name || seller.username || 'صاحب الإعلان'}</Text>
          <View style={styles.sellerBadges}>
            <AccountIdentityBadge role={seller.role} accountType={seller.account_type} isVerified={Boolean(seller.is_verified)} compact />
          </View>
        </View>
        <ArrowUpRight size={18} color={OASIS.colors.primary} />
      </Pressable>}
      {me === item.seller_id && <Pressable oasisKind="action" style={styles.manageBtn} onPress={() => router.push({ pathname: '/profile', params: { tab: 'content' } })}><Text style={styles.manageBtnText}>إدارة من حسابي</Text></Pressable>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:OASIS.colors.background},page:{padding:16,paddingBottom:24,gap:14,width:'100%',maxWidth:860,alignSelf:'center'},
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:16,backgroundColor:OASIS.colors.background},muted:{fontSize:12,color:OASIS.colors.muted,textAlign:'right',lineHeight:19},
  title:{fontSize:21,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right',lineHeight:31},image:{width:'100%',height:260,borderRadius:18,backgroundColor:OASIS.colors.line},imageFallback:{height:190,borderRadius:18,backgroundColor:OASIS.colors.soft,alignItems:'center',justifyContent:'center',gap:8},
  card:{backgroundColor:OASIS.colors.surface,borderRadius:14,borderWidth:1,borderColor:OASIS.colors.line,padding:18,gap:12},row:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},typePill:{backgroundColor:OASIS.colors.soft,paddingHorizontal:10,paddingVertical:5,borderRadius:9},typeText:{fontSize:11,fontWeight:'600',color:OASIS.colors.primary},status:{fontSize:11,color:OASIS.colors.muted,fontWeight:'700'},
  price:{fontSize:19,fontWeight:'700',color:OASIS.colors.primary,textAlign:'right'},description:{fontSize:14,lineHeight:25,color:OASIS.colors.ink,textAlign:'right'},location:{flexDirection:'row-reverse',alignItems:'center',gap:7,paddingTop:6},
  sellerCard:{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line},avatar:{width:44,height:44,borderRadius:22},avatarFallback:{width:44,height:44,borderRadius:22,backgroundColor:OASIS.colors.soft,alignItems:'center',justifyContent:'center'},sellerCopy:{flex:1,gap:4,alignItems:'flex-end'},sellerTitle:{fontSize:14,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},sellerBadges:{flexDirection:'row-reverse',gap:4,flexWrap:'wrap'},manageBtn:{paddingVertical:12,borderRadius:13,backgroundColor:OASIS.colors.soft,alignItems:'center'},manageBtnText:{color:OASIS.colors.primary,fontWeight:'700',fontSize:12},share:{width:38,height:38,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:OASIS.colors.soft},primary:{paddingHorizontal:20,paddingVertical:12,borderRadius:12,backgroundColor:OASIS.colors.primary},primaryText:{color:OASIS.colors.surface,fontWeight:'700'}
});
