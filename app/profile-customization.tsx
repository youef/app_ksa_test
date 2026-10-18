import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronRight, Pin, PinOff, Palette, Sparkles, ArrowUp, ArrowDown, RotateCcw, BookmarkPlus, BriefcaseBusiness, UserRound } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';

type Kind = 'question' | 'service' | 'request' | 'market';
type Candidate = { id: string; type: Kind; title: string; subtitle?: string };
type ProfileSnapshot = { accent: string; banner: string; showStats: boolean; showBadges: boolean; featuredTitle: string; profileType: 'personal' | 'business'; sectionVisibility: Record<string, boolean>; sectionOrder: string[] };
const SECTIONS = [{ id: 'bio', label: 'النبذة الشخصية' }, { id: 'services', label: 'الخدمات' }, { id: 'questions', label: 'الأسئلة والمساهمات' }, { id: 'products', label: 'المنتجات والإعلانات' }, { id: 'reviews', label: 'التقييمات' }, { id: 'achievements', label: 'الإنجازات والشارات' }];
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
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>({ bio: true, services: true, questions: true, products: true, reviews: true, achievements: true });
  const [sectionOrder, setSectionOrder] = useState<string[]>(SECTIONS.map(x => x.id));
  const [savedTemplates, setSavedTemplates] = useState<Array<{ name: string; snapshot: ProfileSnapshot; created_at: string }>>([]);
  const [history, setHistory] = useState<ProfileSnapshot[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<ProfileSnapshot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      const id = auth.user.id;
      setUid(id);
      const [settings, questions, services, requests, market, pins, privateData] = await Promise.all([
        supabase.from('profile_customizations').select('*').eq('user_id', id).maybeSingle(),
        supabase.from('questions').select('id,title,body').eq('author_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('services').select('id,name,description').eq('provider_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('requests').select('id,title,description').eq('requester_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('marketplace_items').select('id,title,description').eq('seller_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('profile_featured_items').select('item_type,item_id').eq('user_id', id).order('position', { ascending: true }),
        supabase.from('profile_customization_private').select('saved_templates,customization_history').eq('user_id', id).maybeSingle(),
      ]);
      const failed = [settings, questions, services, requests, market, pins, privateData].find((result: any) => result.error);
      if (failed?.error) throw failed.error;
      const s = settings.data;
      if (s) {
        setAccent(s.accent_color || '#059669');
        setBanner(s.banner_style || 'emerald');
        setShowStats(s.show_stats !== false);
        setShowBadges(s.show_badges !== false);
        setFeaturedTitle(s.featured_title || 'أعمالي المميزة');
        setProfileType(s.profile_type === 'business' ? 'business' : 'personal');
        setSectionVisibility({ bio: true, services: true, questions: true, products: true, reviews: true, achievements: true, ...(s.section_visibility || {}) });
        setSectionOrder(Array.isArray(s.section_order) ? [...s.section_order.filter((id: string) => SECTIONS.some(x => x.id === id)), ...SECTIONS.map(x => x.id).filter(id => !s.section_order.includes(id))] : SECTIONS.map(x => x.id));
      }
      const list: Candidate[] = [
        ...(questions.data || []).map((x: any) => ({ id: x.id, type: 'question' as const, title: x.title || 'استفسار بدون عنوان', subtitle: x.body })),
        ...(services.data || []).map((x: any) => ({ id: x.id, type: 'service' as const, title: x.name || 'خدمة', subtitle: x.description })),
        ...(requests.data || []).map((x: any) => ({ id: x.id, type: 'request' as const, title: x.title || 'طلب', subtitle: x.description })),
        ...(market.data || []).map((x: any) => ({ id: x.id, type: 'market' as const, title: x.title || 'إعلان', subtitle: x.description })),
      ];
      setCandidates(list);
      setSavedTemplates(Array.isArray(privateData.data?.saved_templates) ? privateData.data.saved_templates : []);
      setHistory(Array.isArray(privateData.data?.customization_history) ? privateData.data.customization_history : []);
      const initialSnapshot: ProfileSnapshot = { accent: settings.data?.accent_color || '#059669', banner: settings.data?.banner_style || 'emerald', showStats: settings.data?.show_stats !== false, showBadges: settings.data?.show_badges !== false, featuredTitle: settings.data?.featured_title || 'أعمالي المميزة', profileType: settings.data?.profile_type === 'business' ? 'business' : 'personal', sectionVisibility: { bio: true, services: true, questions: true, products: true, reviews: true, achievements: true, ...(settings.data?.section_visibility || {}) }, sectionOrder: Array.isArray(settings.data?.section_order) ? settings.data.section_order : SECTIONS.map(x => x.id) };
      setSavedSnapshot(initialSnapshot);
      setFeatured((pins.data || []).map((x: any) => x.item_type + ':' + x.item_id));
    } catch (e: any) {
      Alert.alert('تعذّر تحميل الإعدادات', e?.message || 'حاول مرة أخرى.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function snapshot(): ProfileSnapshot {
    return { accent, banner, showStats, showBadges, featuredTitle: featuredTitle.trim() || 'أعمالي المميزة', profileType, sectionVisibility: { ...sectionVisibility }, sectionOrder: [...sectionOrder] };
  }

  async function saveSettings() {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const previous = savedSnapshot || snapshot();
      const nextHistory = [previous, ...history].slice(0, 20);
      const { error } = await supabase.from('profile_customizations').upsert({
        user_id: uid, accent_color: accent, banner_style: banner, show_stats: showStats,
        show_badges: showBadges, featured_title: featuredTitle.trim() || 'أعمالي المميزة',
        profile_type: profileType, section_visibility: sectionVisibility, section_order: sectionOrder,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: privateError } = await supabase.from('profile_customization_private').upsert({ user_id: uid, saved_templates: savedTemplates, customization_history: nextHistory, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (privateError) throw privateError;
      setHistory(nextHistory); setSavedSnapshot(snapshot());
      Alert.alert('تم الحفظ', 'تم حفظ إعدادات الملف وسجل التغييرات.');
    } catch (e: any) {
      Alert.alert('تعذّر الحفظ', e?.message || 'تأكد من تطبيق تحديث قاعدة البيانات ثم حاول مجدداً.');
    } finally { setSaving(false); }
  }

  async function saveTemplate() {
    const name = profileType === 'business' ? 'الهوية التجارية' : 'الهوية الشخصية';
    const template = { name: `${name} ${savedTemplates.length + 1}`, snapshot: snapshot(), created_at: new Date().toISOString() };
    const next = [template, ...savedTemplates].slice(0, 10);
    setSavedTemplates(next);
    try {
      const { error } = await supabase.from('profile_customizations').upsert({
        user_id: uid, accent_color: accent, banner_style: banner, show_stats: showStats,
        show_badges: showBadges, featured_title: featuredTitle.trim() || 'أعمالي المميزة',
        profile_type: profileType, section_visibility: sectionVisibility, section_order: sectionOrder,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: privateError } = await supabase.from('profile_customization_private').upsert({ user_id: uid, saved_templates: next, customization_history: history, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (privateError) throw privateError;
      Alert.alert('تم حفظ القالب', 'يمكنك تطبيقه في أي وقت من قائمة القوالب المحفوظة.');
    } catch (e: any) {
      setSavedTemplates(savedTemplates);
      Alert.alert('تعذّر حفظ القالب', e?.message || 'تحقق من تحديث قاعدة البيانات.');
    }
  }

  function applySnapshot(value: ProfileSnapshot) {
    setAccent(value.accent || '#059669'); setBanner(value.banner || 'emerald');
    setShowStats(value.showStats !== false); setShowBadges(value.showBadges !== false);
    setFeaturedTitle(value.featuredTitle || 'أعمالي المميزة');
    setProfileType(value.profileType === 'business' ? 'business' : 'personal');
    setSectionVisibility(value.sectionVisibility || {});
    setSectionOrder(value.sectionOrder || SECTIONS.map(x => x.id));
  }

  async function restorePrevious() {
    if (!history.length) return Alert.alert('لا يوجد سجل', 'ستظهر هنا النسخ السابقة بعد حفظ تغييراتك.');
    const [previous, ...remaining] = history;
    applySnapshot(previous);
    setHistory(remaining);
    try {
      const { error } = await supabase.from('profile_customizations').upsert({
        user_id: uid, accent_color: previous.accent, banner_style: previous.banner,
        show_stats: previous.showStats, show_badges: previous.showBadges,
        featured_title: previous.featuredTitle, profile_type: previous.profileType,
        section_visibility: previous.sectionVisibility, section_order: previous.sectionOrder,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: privateError } = await supabase.from('profile_customization_private').upsert({ user_id: uid, saved_templates: savedTemplates, customization_history: remaining, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (privateError) throw privateError;
      setSavedSnapshot(previous);
      Alert.alert('تمت الاستعادة', 'أعدنا آخر نسخة محفوظة من تخصيصات الملف.');
    } catch (e: any) { Alert.alert('تعذّرت الاستعادة', e?.message || 'حاول مرة أخرى.'); }
  }

  async function applyTemplate(template: { name: string; snapshot: ProfileSnapshot }) {
    applySnapshot(template.snapshot);
    try {
      const value = template.snapshot;
      const nextHistory = [savedSnapshot || snapshot(), ...history].slice(0, 20);
      const { error } = await supabase.from('profile_customizations').upsert({
        user_id: uid, accent_color: value.accent, banner_style: value.banner,
        show_stats: value.showStats, show_badges: value.showBadges,
        featured_title: value.featuredTitle, profile_type: value.profileType,
        section_visibility: value.sectionVisibility, section_order: value.sectionOrder,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: privateError } = await supabase.from('profile_customization_private').upsert({ user_id: uid, saved_templates: savedTemplates, customization_history: nextHistory, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (privateError) throw privateError;
      setHistory(nextHistory); setSavedSnapshot(template.snapshot);
      Alert.alert('تم تطبيق القالب', template.name);
    } catch (e: any) { Alert.alert('تعذّر تطبيق القالب', e?.message || 'حاول مرة أخرى.'); }
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSectionOrder(current => {
      const next = [...current];
      const index = next.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
      const message = String(e?.message || '');
      const friendly = message.includes('featured_item_not_owned')
        ? 'لا يمكن تثبيت محتوى لا تملكه.'
        : message.includes('featured_limit_reached')
          ? 'وصلت إلى الحد الأقصى: 10 أعمال مميزة.'
          : message || 'حاول مرة أخرى.';
      Alert.alert('تعذّر تحديث الأعمال المميزة', friendly);
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
        <View style={styles.sectionHead}><BriefcaseBusiness color={accent} size={20} /><Text style={styles.heading}>نوع الهوية</Text></View>
        <Text style={styles.muted}>بدّل بين عرض شخصي وواجهة مناسبة للأعمال والخدمات.</Text>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setProfileType('personal')} style={[styles.modeBtn, profileType === 'personal' && { backgroundColor: accent, borderColor: accent }]}><UserRound size={17} color={profileType === 'personal' ? '#fff' : '#475569'} /><Text style={[styles.modeText, profileType === 'personal' && styles.modeTextActive]}>شخصية</Text></Pressable>
          <Pressable onPress={() => setProfileType('business')} style={[styles.modeBtn, profileType === 'business' && { backgroundColor: accent, borderColor: accent }]}><BriefcaseBusiness size={17} color={profileType === 'business' ? '#fff' : '#475569'} /><Text style={[styles.modeText, profileType === 'business' && styles.modeTextActive]}>تجارية</Text></Pressable>
        </View>
        <View style={styles.sectionHead}><Palette color={accent} size={20} /><Text style={styles.heading}>أقسام البروفايل</Text></View>
        <Text style={styles.muted}>فعّل الأقسام التي تريد عرضها ورتّب ظهورها. استخدم الأسهم لتحريك القسم، ثم احفظ التخصيصات.</Text>
        {sectionOrder.map((id, index) => {
          const section = SECTIONS.find(x => x.id === id);
          if (!section) return null;
          return <View key={id} style={styles.sectionRow}>
            <View style={styles.sectionControls}>
              <Pressable onPress={() => moveSection(id, -1)} disabled={index === 0} style={styles.orderBtn}><ArrowUp size={15} color={index === 0 ? '#cbd5e1' : '#475569'} /></Pressable>
              <Pressable onPress={() => moveSection(id, 1)} disabled={index === sectionOrder.length - 1} style={styles.orderBtn}><ArrowDown size={15} color={index === sectionOrder.length - 1 ? '#cbd5e1' : '#475569'} /></Pressable>
            </View>
            <View style={styles.switchCopy}><Text style={styles.label}>{section.label}</Text><Text style={styles.muted}>ترتيب العرض: {index + 1}</Text></View>
            <Switch value={sectionVisibility[id] !== false} onValueChange={v => setSectionVisibility(prev => ({ ...prev, [id]: v }))} trackColor={{ true: accent }} />
          </View>;
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}><BookmarkPlus color="#7c3aed" size={20} /><Text style={styles.heading}>القوالب وسجل التغييرات</Text></View>
        <Text style={styles.muted}>احفظ إعدادات مختلفة لهويتك الشخصية أو التجارية، واستعد نسخة سابقة عند الحاجة.</Text>
        <View style={styles.templateActions}>
          <Pressable onPress={() => void saveTemplate()} style={[styles.templateBtn, { backgroundColor: accent }]}><BookmarkPlus size={16} color="#fff" /><Text style={styles.templateBtnText}>حفظ كقالب</Text></Pressable>
          <Pressable onPress={() => void restorePrevious()} style={styles.undoBtn}><RotateCcw size={16} color="#475569" /><Text style={styles.undoText}>تراجع عن آخر حفظ</Text></Pressable>
        </View>
        {savedTemplates.length > 0 ? savedTemplates.map((template, index) => <View key={template.created_at + index} style={styles.templateRow}><View style={styles.itemCopy}><Text style={styles.itemTitle}>{template.name}</Text><Text style={styles.muted}>{new Date(template.created_at).toLocaleDateString('ar-SA')}</Text></View><Pressable onPress={() => void applyTemplate(template)} style={styles.pinBtn}><Check size={15} color="#047857" /><Text style={styles.pinText}>تطبيق</Text></Pressable></View>) : <Text style={styles.empty}>لم تحفظ قوالب بعد. اضغط «حفظ كقالب» للاحتفاظ بالهوية الحالية.</Text>}
        <Text style={styles.label}>النسخ السابقة المحفوظة: {history.length}</Text>
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
  modeRow:{flexDirection:'row-reverse',gap:10}, modeBtn:{flex:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:'#e2e8f0',borderRadius:12,padding:12,backgroundColor:'#f8fafc'}, modeText:{fontSize:13,fontWeight:'800',color:'#475569'}, modeTextActive:{color:'#fff'}, sectionRow:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#f1f5f9'}, sectionControls:{flexDirection:'row',gap:4}, orderBtn:{width:30,height:30,borderRadius:9,backgroundColor:'#f1f5f9',alignItems:'center',justifyContent:'center'}, templateActions:{flexDirection:'row-reverse',gap:8}, templateBtn:{flex:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:6,borderRadius:12,padding:11}, templateBtnText:{fontSize:12,fontWeight:'900',color:'#fff'}, undoBtn:{flex:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:6,borderWidth:1,borderColor:'#e2e8f0',borderRadius:12,padding:11,backgroundColor:'#f8fafc'}, undoText:{fontSize:11.5,fontWeight:'800',color:'#475569'}, templateRow:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#f1f5f9'},
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
