import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, Pin, PinOff, Palette, Sparkles } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';

type Kind = 'question' | 'service' | 'request' | 'market';
type Candidate = { id: string; type: Kind; title: string; subtitle?: string };
const COLORS = ['#059669', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0f172a'];
const BANNERS = [{ id: 'emerald', label: 'أخضر حيّنا' }, { id: 'ocean', label: 'أزرق' }, { id: 'sunset', label: 'غروب' }, { id: 'midnight', label: 'ليلي' }];

export default function ProfileCustomization() {
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accent, setAccent] = useState('#059669');
  const [banner, setBanner] = useState('emerald');
  const [showStats, setShowStats] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [featuredTitle, setFeaturedTitle] = useState('أعمالي المميزة');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [featured, setFeatured] = useState<string[]>([]);
  const [busyItem, setBusyItem] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      const id = auth.user.id;
      setUid(id);
      const [settings, questions, services, requests, market, pins] = await Promise.all([
        supabase.from('profile_customizations').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('questions').select('id,title,body').eq('author_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('services').select('id,name,description').eq('provider_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('requests').select('id,title,description').eq('requester_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('marketplace_items').select('id,title,description').eq('seller_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('profile_featured_items').select('item_type,item_id').eq('user_id', id).order('position', { ascending: true }),
      ]);
      const failed = [settings, questions, services, requests, market, pins].find((result: any) => result.error);
      if (failed?.error) throw failed.error;
      const s = settings.data;
      if (s) {
        setAccent(s.accent_color || '#059669');
        setBanner(s.banner_style || 'emerald');
        setShowStats(s.show_stats !== false);
        setShowBadges(s.show_badges !== false);
        setFeaturedTitle(s.featured_title || 'أعمالي المميزة');
      }
      const list: Candidate[] = [
        ...(questions.data || []).map((x: any) => ({ id: x.id, type: 'question' as const, title: x.title || 'استفسار بدون عنوان', subtitle: x.body })),
        ...(services.data || []).map((x: any) => ({ id: x.id, type: 'service' as const, title: x.name || 'خدمة', subtitle: x.description })),
        ...(requests.data || []).map((x: any) => ({ id: x.id, type: 'request' as const, title: x.title || 'طلب', subtitle: x.description })),
        ...(market.data || []).map((x: any) => ({ id: x.id, type: 'market' as const, title: x.title || 'إعلان', subtitle: x.description })),
      ];
      setCandidates(list);
      setFeatured((pins.data || []).map((x: any) => x.item_type + ':' + x.item_id));
    } catch (e: any) {
      Alert.alert('تعذّر تحميل الإعدادات', e?.message || 'حاول مرة أخرى.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveSettings() {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profile_customizations').upsert({
        user_id: uid, accent_color: accent, banner_style: banner, show_stats: showStats,
        show_badges: showBadges, featured_title: featuredTitle.trim() || 'أعمالي المميزة',
      }, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('تم الحفظ', 'تم حفظ تخصيصات ملفك في قاعدة البيانات.');
    } catch (e: any) {
      Alert.alert('تعذّر الحفظ', e?.message || 'تأكد من تطبيق تحديث قاعدة البيانات ثم حاول مجدداً.');
    } finally { setSaving(false); }
  }

  async function toggleFeatured(item: Candidate) {
    if (!uid || busyItem) return;
    const key = item.type + ':' + item.id;
    setBusyItem(key);
    try {
      if (featured.includes(key)) {
        const { error } = await supabase.from('profile_featured_items').delete().eq('user_id', uid).eq('item_type', item.type).eq('item_id', item.id);
        if (error) throw error;
        setFeatured(prev => prev.filter(x => x !== key));
      } else {
        if (featured.length >= 10) throw new Error('يمكنك تثبيت 10 أعمال كحد أقصى.');
        const { error } = await supabase.from('profile_featured_items').insert({ user_id: uid, item_type: item.type, item_id: item.id, position: featured.length });
        if (error) throw error;
        setFeatured(prev => [...prev, key]);
      }
    } catch (e: any) {
      Alert.alert('تعذّر تحديث الأعمال المميزة', e?.message?.includes('featured_item_not_owned') ? 'لا يمكن تثبيت محتوى لا تملكه.' : e?.message || 'حاول مرة أخرى.');
    } finally { setBusyItem(''); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /><Text style={styles.muted}>جارٍ تحميل تخصيصات الملف...</Text></View>;

  return <View style={styles.screen}>
    <AppHeader variant="sub" title="تخصيص الملف" subtitle="تحكم بمظهر ملفك وأعمالك المميزة" fallbackRoute="/profile" />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <View style={styles.sectionHead}><Palette color={accent} size={20} /><Text style={styles.heading}>معاينة مباشرة</Text></View>
        <View style={[styles.previewBanner, { backgroundColor: banner === 'ocean' ? '#0369a1' : banner === 'sunset' ? '#c2410c' : banner === 'midnight' ? '#111827' : '#047857' }]}>
          <View style={styles.previewAvatar}><Text style={styles.previewAvatarText}>ح</Text></View>
          <View style={styles.previewCopy}><Text style={styles.previewName}>ملفك في حيّنا</Text><Text style={styles.previewSub}>معاينة تقريبية قبل الحفظ</Text></View>
          <View style={styles.previewChip}><Text style={styles.previewChipText}>@username</Text></View>
        </View>
        <View style={[styles.previewStats, { opacity: showStats ? 1 : 0.45 }]}><Text style={styles.previewStat}>{showStats ? 'متابعون ١٢' : 'الإحصائيات مخفية'}</Text><Text style={styles.previewStat}>{showBadges ? 'شارات مفعّلة' : 'الشارات مخفية'}</Text></View>
        <View style={styles.sectionHead}><Palette color={accent} size={20} /><Text style={styles.heading}>مظهر الملف</Text></View>
        <Text style={styles.label}>اللون الرئيسي</Text>
        <View style={styles.colorRow}>{COLORS.map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={'اختيار اللون '+color} onPress={() => setAccent(color)} style={[styles.swatch,{backgroundColor:color},accent===color&&styles.selectedSwatch]}>{accent===color&&<Check size={17} color="#fff" />}</Pressable>)}</View>
        <Text style={styles.label}>نمط الغلاف</Text>
        <View style={styles.bannerList}>{BANNERS.map(x => <Pressable key={x.id} onPress={() => setBanner(x.id)} style={[styles.choice,banner===x.id&&styles.choiceActive]}><Text style={[styles.choiceText,banner===x.id&&styles.choiceTextActive]}>{x.label}</Text>{banner===x.id&&<Check size={16} color="#059669" />}</Pressable>)}</View>
        <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.label}>إظهار الإحصائيات</Text><Text style={styles.muted}>عدد المتابعين والمساهمات</Text></View><Switch value={showStats} onValueChange={setShowStats} trackColor={{true:accent}} /></View>
        <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.label}>إظهار الشارات</Text><Text style={styles.muted}>الشارات والتوثيق المجتمعي</Text></View><Switch value={showBadges} onValueChange={setShowBadges} trackColor={{true:accent}} /></View>
        <Text style={styles.label}>عنوان قسم الأعمال المميزة</Text>
        <TextInput value={featuredTitle} onChangeText={setFeaturedTitle} maxLength={40} placeholder="أعمالي المميزة" textAlign="right" style={styles.input} />
        <Pressable onPress={saveSettings} disabled={saving} style={[styles.saveBtn,{backgroundColor:accent}]}>{saving?<ActivityIndicator color="#fff" />:<><Check size={17} color="#fff" /><Text style={styles.saveText}>حفظ التخصيصات</Text></>}</Pressable>
      </View>
      <View style={styles.card}>
        <View style={styles.sectionHead}><Sparkles color="#d97706" size={20} /><Text style={styles.heading}>أعمالي المميزة</Text></View>
        <Text style={styles.muted}>ثبّت حتى 10 عناصر من منشوراتك لتظهر في ملفك العام. اضغط مرة أخرى لإلغاء التثبيت.</Text>
        {candidates.length===0?<Text style={styles.empty}>لا توجد أعمال منشورة يمكن تثبيتها حتى الآن.</Text>:candidates.map(item=>{
          const key=item.type+':'+item.id; const active=featured.includes(key); const busy=busyItem===key;
          const kindLabel=item.type==='question'?'استفسار':item.type==='service'?'خدمة':item.type==='request'?'طلب':'إعلان';
          return <View key={key} style={styles.itemRow}><View style={styles.itemCopy}><Text numberOfLines={2} style={styles.itemTitle}>{item.title}</Text><Text style={styles.muted}>{kindLabel}</Text></View><Pressable onPress={()=>void toggleFeatured(item)} disabled={!!busyItem} style={[styles.pinBtn,active&&styles.pinBtnActive]}>{busy?<ActivityIndicator size="small" color="#059669" />:active?<><PinOff size={15} color="#047857" /><Text style={styles.pinText}>إلغاء</Text></>:<><Pin size={15} color="#475569" /><Text style={styles.pinText}>تثبيت</Text></>}</Pressable></View>
        })}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f8fafc'}, page:{padding:16,paddingBottom:36,gap:14,maxWidth:900,width:'100%',alignSelf:'center'},
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#f8fafc'}, card:{backgroundColor:'#fff',borderRadius:20,padding:18,borderWidth:1,borderColor:'#e2e8f0',gap:12},
  sectionHead:{flexDirection:'row-reverse',alignItems:'center',gap:9}, heading:{fontSize:18,fontWeight:'900',color:'#0f172a',textAlign:'right'},
  label:{fontSize:13,fontWeight:'800',color:'#334155',textAlign:'right'}, muted:{fontSize:12,color:'#64748b',textAlign:'right'}, colorRow:{flexDirection:'row-reverse',gap:12,flexWrap:'wrap'},
  previewBanner:{minHeight:108,borderRadius:16,padding:14,flexDirection:'row-reverse',alignItems:'center',gap:10},previewAvatar:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.45)'},previewAvatarText:{fontSize:22,fontWeight:'900',color:'#fff'},previewCopy:{flex:1,gap:4},previewName:{fontSize:15,fontWeight:'900',color:'#fff',textAlign:'right'},previewSub:{fontSize:10,color:'#e2e8f0',textAlign:'right'},previewChip:{borderRadius:9,paddingHorizontal:8,paddingVertical:5,backgroundColor:'rgba(255,255,255,0.18)'},previewChipText:{fontSize:10,fontWeight:'800',color:'#fff'},previewStats:{flexDirection:'row-reverse',justifyContent:'space-around',padding:10,borderRadius:12,backgroundColor:'#f1f5f9'},previewStat:{fontSize:11,fontWeight:'800',color:'#334155'},
  swatch:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},selectedSwatch:{borderWidth:3,borderColor:'#cbd5e1'},
  bannerList:{gap:8},choice:{padding:12,borderRadius:12,borderWidth:1,borderColor:'#e2e8f0',flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},choiceActive:{backgroundColor:'#ecfdf5',borderColor:'#6ee7b7'},choiceText:{color:'#475569',fontWeight:'700'},choiceTextActive:{color:'#047857'},
  switchRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',paddingVertical:6},switchCopy:{flex:1,gap:3},input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:12,padding:12,color:'#0f172a',backgroundColor:'#fff'},
  saveBtn:{borderRadius:13,padding:14,alignItems:'center',justifyContent:'center',flexDirection:'row-reverse',gap:8,minHeight:48},saveText:{color:'#fff',fontWeight:'900'},
  itemRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:12,borderTopWidth:1,borderColor:'#f1f5f9',paddingTop:12},itemCopy:{flex:1,gap:4},itemTitle:{fontSize:13,fontWeight:'800',color:'#0f172a',textAlign:'right'},pinBtn:{borderRadius:10,borderWidth:1,borderColor:'#cbd5e1',paddingHorizontal:12,paddingVertical:9,flexDirection:'row-reverse',alignItems:'center',gap:6},pinBtnActive:{backgroundColor:'#ecfdf5',borderColor:'#a7f3d0'},pinText:{fontSize:12,fontWeight:'800',color:'#334155'},empty:{padding:16,textAlign:'center',color:'#64748b'}
});
