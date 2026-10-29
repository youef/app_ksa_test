import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Check, ImagePlus, Images, Minus, Plus, RotateCcw, Save, Trash2, X, Eye, ShieldCheck } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { DEFAULT_BACKGROUND_SOURCES } from '@/hooks/usePageBackground';
import { usePlatformConfig } from '@/lib/platformConfig';
import { supabase } from '@/lib/supabase';
import { BACKGROUND_BUCKET, BACKGROUND_CONFIG_KEY, BACKGROUND_SLOTS, DEFAULT_PAGE_BACKGROUNDS, MAX_BACKGROUND_BYTES, detectBackgroundImage, isBackgroundPath, parsePageBackgrounds, type BackgroundSlot, type PageBackground } from '@/lib/pageBackgrounds';

const LABELS = { welcome: 'الترحيب', login: 'تسجيل الدخول', app: 'الصفحات الداخلية', chat: 'الدردشة' };
const NOTES = { welcome: 'خلفية شاشة الترحيب الأولى.', login: 'خلفية تسجيل الدخول وإنشاء الحساب.', app: 'الرئيسية والسوق واليوميات واستكشف والملفات وبقية الصفحات الداخلية عدا المحادثات.', chat: 'خلفية جميع المحادثات الخاصة. تظهر تلقائيًا للمستخدمين بعد تطبيقها، بشكل مستقل عن خلفية الصفحات الداخلية.' };
type Draft = { setting: PageBackground; file?: ImagePicker.ImagePickerAsset };
type LibraryImage = { name: string };
const imageUrl = (path: string) => supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(path).data.publicUrl;

export default function AdminBackgrounds() {
  const { colors: c } = useTheme();
  const { backgrounds, refresh } = usePlatformConfig();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [slot, setSlot] = useState<BackgroundSlot>('app');
  const [drafts, setDrafts] = useState<Partial<Record<BackgroundSlot, Draft>>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const draft = drafts[slot] || { setting: backgrounds[slot] };
  const preview = draft.file ? { uri: draft.file.uri } : draft.setting.path ? { uri: imageUrl(draft.setting.path) } : DEFAULT_BACKGROUND_SOURCES[slot];
  const changed = Boolean(drafts[slot]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const { data } = auth.user ? await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle() : { data: null };
        if (active) setAllowed(data?.role === 'admin');
      } catch { if (active) setAllowed(false); }
    })();
    return () => { active = false; };
  }, []);

  const loadLibrary = useCallback(async (offset = 0) => {
    setLibraryBusy(true);
    try {
      const { data, error } = await supabase.storage.from(BACKGROUND_BUCKET).list('backgrounds', { limit: 60, offset, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      const rows = (data || []).filter(item => item.id && isBackgroundPath(`backgrounds/${item.name}`));
      setLibrary(previous => offset ? [...previous, ...rows.filter(row => !previous.some(old => old.name === row.name))] : rows);
      setHasMore((data?.length || 0) === 60);
      setNextOffset(offset + (data?.length || 0));
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : 'تعذر تحميل مكتبة الصور.' }); }
    finally { setLibraryBusy(false); }
  }, []);

  useEffect(() => { if (allowed && libraryOpen) void loadLibrary(); }, [allowed, libraryOpen, loadLibrary]);

  function patchDraft(setting: Partial<PageBackground>, file?: ImagePicker.ImagePickerAsset) {
    setDrafts(previous => ({ ...previous, [slot]: { ...previous[slot], setting: { ...(previous[slot]?.setting || backgrounds[slot]), ...setting }, ...(file ? { file } : {}) } }));
    setNotice(null);
  }

  async function pickImage() {
    if (busyRef.current) return;
    setNotice(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error('اسمح بالوصول إلى الصور لاختيار الخلفية.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      if (!file.width || !file.height) throw new Error('تعذر قراءة الصورة. اختر صورة سليمة ثم حاول مجددًا.');
      if ((file.fileSize || 0) > MAX_BACKGROUND_BYTES) throw new Error('حجم الصورة يجب ألا يتجاوز ٥ ميجابايت.');
      patchDraft({}, file);
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : 'تعذر اختيار الصورة.' }); }
  }

  async function apply(setting = draft.setting, file: ImagePicker.ImagePickerAsset | null = draft.file || null) {
    if (!allowed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setNotice(null);
    try {
      let path = setting.path;
      if (file) {
        const response = await fetch(file.uri);
        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_BACKGROUND_BYTES) throw new Error('اختر صورة لا يتجاوز حجمها ٥ ميجابايت.');
        const format = detectBackgroundImage(new Uint8Array(bytes));
        if (!format) throw new Error('الصيغ المدعومة: PNG وJPG وWebP وGIF.');
        path = `backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${format.extension}`;
        const { error } = await supabase.storage.from(BACKGROUND_BUCKET).upload(path, bytes, { contentType: format.mime, cacheControl: '31536000', upsert: false });
        if (error) throw error;
        // Keep the uploaded image available for retry if applying the configuration fails.
        setDrafts(previous => ({ ...previous, [slot]: { setting: { ...setting, path } } }));
      }
      const { error } = await supabase.rpc('hayna_set_page_background', { p_slot: slot, p_path: path, p_light_opacity: setting.lightOpacity, p_dark_opacity: setting.darkOpacity });
      if (error) throw error;
      await refresh();
      setDrafts(previous => { const next = { ...previous }; delete next[slot]; return next; });
      setNotice({ error: false, text: `تم تطبيق خلفية ${LABELS[slot]}، وتظهر التغييرات للجميع مباشرة.` });
      if (libraryOpen) void loadLibrary();
    } catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : (error as { message?: string })?.message || 'تعذر تطبيق الخلفية. حاول مجددًا.' }); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function removeImage(item: LibraryImage) {
    const path = `backgrounds/${item.name}`;
    Alert.alert('حذف الصورة من المكتبة؟', 'سيتم حذف هذه الصورة غير المستخدمة من التخزين.', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'حذف الصورة', style: 'destructive', onPress: () => { void (async () => {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true); setNotice(null);
        try {
          const { data, error } = await supabase.from('app_config').select('value').eq('key', BACKGROUND_CONFIG_KEY).maybeSingle();
          if (error) throw error;
          const live = parsePageBackgrounds(data?.value);
          if (BACKGROUND_SLOTS.some(key => live[key].path === path)) throw new Error('الصورة مستخدمة حاليًا. غيّر الخلفية أولًا ثم احذفها.');
          if (Object.values(drafts).some(value => value?.setting.path === path)) throw new Error('الصورة ضمن معاينة غير مطبقة. غيّر المعاينة أولًا.');
          const result = await supabase.storage.from(BACKGROUND_BUCKET).remove([path]);
          if (result.error) throw result.error;
          if (!result.data?.length) throw new Error('لم تُحذف الصورة. تحقق من صلاحية الإدارة.');
          setLibrary(previous => previous.filter(row => row.name !== item.name));
          setNotice({ error: false, text: 'حُذفت الصورة من المكتبة.' });
        } catch (error) { setNotice({ error: true, text: (error as { message?: string })?.message || 'تعذر حذف الصورة.' }); }
        finally { busyRef.current = false; setBusy(false); }
      })(); } },
    ]);
  }

  if (allowed === null) return <View style={s.center}><ActivityIndicator color={c.primary} /><Text style={{ color: c.muted }}>جارٍ التحقق من صلاحية الإدارة…</Text></View>;
  if (!allowed) return <View style={s.center}><ShieldCheck size={32} color={c.danger} /><Text style={{ color: c.ink, textAlign: 'center' }}>إدارة الخلفيات متاحة لأدمن المنصة فقط.</Text></View>;

  return <View style={s.wrap}>
    <View style={s.heading}><Images size={24} color={c.primary} /><Text style={[s.title, { color: c.ink }]}>صور وخلفيات الصفحات</Text></View>
    <Text style={[s.description, { color: c.muted }]}>اختر الصفحة، عاين الصورة، ثم طبّقها. كل خلفية مستقلة عن الأخرى.</Text>
    <View style={s.slots}>{BACKGROUND_SLOTS.map(key => <Pressable oasisKind="plain" key={key} disabled={busy} accessibilityRole="button" accessibilityLabel={`تعديل خلفية ${LABELS[key]}`} accessibilityState={{ selected: slot === key }} onPress={() => { setSlot(key); setNotice(null); }} style={[s.slot, { backgroundColor: slot === key ? c.soft : c.surface, borderColor: slot === key ? c.primary : c.line }]}><Text style={[s.slotTitle, { color: slot === key ? c.primary : c.ink }]}>{LABELS[key]}</Text>{drafts[key] ? <View style={[s.dirtyDot, { backgroundColor: c.warning }]} /> : null}</Pressable>)}</View>
    <View style={[s.panel, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={s.heading}><Text style={[s.panelTitle, { color: c.ink }]}>خلفية {LABELS[slot]}</Text><Text style={[s.status, { color: changed ? c.warning : c.primary, backgroundColor: changed ? c.warningSoft : c.soft }]}>{changed ? 'معاينة غير مطبقة' : draft.setting.path ? 'صورة مخصصة' : 'الخلفية الأصلية'}</Text></View>
      <Text style={[s.description, { color: c.muted }]}>{NOTES[slot]}</Text>
      <Pressable oasisKind="plain" accessibilityLabel="عرض صورة الخلفية كاملة" onPress={() => setPreviewOpen(true)} style={[s.preview, { backgroundColor: c.soft }]}><Image source={preview} style={StyleSheet.absoluteFillObject} resizeMode="cover" /><View style={s.previewBadge}><Eye size={16} color="#FFFFFF" /><Text style={s.whiteSmall}>عرض الصورة كاملة</Text></View></Pressable>
      <View style={s.actions}><Pressable oasisKind="plain" disabled={busy} onPress={() => void pickImage()} style={[s.secondary, { backgroundColor: c.soft }]}><ImagePlus size={18} color={c.primary} /><Text style={[s.buttonText, { color: c.primary }]}>اختيار صورة</Text></Pressable><Pressable oasisKind="plain" disabled={busy} onPress={() => setLibraryOpen(value => !value)} accessibilityState={{ expanded: libraryOpen }} style={[s.secondary, { borderWidth: 1, borderColor: c.line }]}><Images size={18} color={c.primary} /><Text style={[s.buttonText, { color: c.primary }]}>مكتبة الصور</Text></Pressable></View>
      <Text style={[s.small, { color: c.muted }]}>PNG · JPG · WebP · GIF — حتى ٥ ميجابايت. يُفضّل اختيار صورة طولية عالية الجودة.</Text>
      {(['lightOpacity','darkOpacity'] as const).map(key => <View style={s.opacityRow} key={key}><Text style={[s.opacityLabel, { color: c.ink }]}>درجة الظهور في الوضع {key === 'lightOpacity' ? 'الفاتح' : 'الداكن'}</Text><View style={s.stepper}><Pressable oasisKind="plain" disabled={busy || draft.setting[key] <= 0.05} accessibilityLabel={`تقليل ظهور الخلفية ${key === 'lightOpacity' ? 'الفاتحة' : 'الداكنة'}`} onPress={() => patchDraft({ [key]: Math.max(0.05, (Math.round(draft.setting[key] * 100) - 5) / 100) })} style={[s.stepButton, { backgroundColor: c.soft }]}><Minus size={16} color={c.primary} /></Pressable><Text style={[s.percent, { color: c.ink }]}>{Math.round(draft.setting[key] * 100)}٪</Text><Pressable oasisKind="plain" disabled={busy || draft.setting[key] >= 1} accessibilityLabel={`زيادة ظهور الخلفية ${key === 'lightOpacity' ? 'الفاتحة' : 'الداكنة'}`} onPress={() => patchDraft({ [key]: Math.min(1, (Math.round(draft.setting[key] * 100) + 5) / 100) })} style={[s.stepButton, { backgroundColor: c.soft }]}><Plus size={16} color={c.primary} /></Pressable></View></View>)}
      {notice ? <View accessibilityRole={notice.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.notice, { backgroundColor: notice.error ? c.dangerSoft : c.soft }]}><Text style={{ color: notice.error ? c.danger : c.primary, textAlign: 'right', lineHeight: 22 }}>{notice.text}</Text></View> : null}
      <Pressable oasisKind="plain" accessibilityLabel="تطبيق الخلفية للجميع" disabled={busy || !changed} onPress={() => void apply()} style={[s.primary, { opacity: busy || !changed ? 0.5 : 1 }]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Save size={18} color="#FFFFFF" />}<Text style={[s.buttonText, { color: '#FFFFFF' }]}>{busy ? 'جارٍ الحفظ…' : 'تطبيق الخلفية للجميع'}</Text></Pressable>
      <Pressable oasisKind="plain" disabled={busy} onPress={() => void apply(DEFAULT_PAGE_BACKGROUNDS[slot], null)} style={s.restore}><RotateCcw size={15} color={c.muted} /><Text style={[s.small, { color: c.muted }]}>استعادة الخلفية الأصلية</Text></Pressable>
    </View>
    {libraryOpen ? <View style={[s.panel, { backgroundColor: c.surface, borderColor: c.line }]}><View style={s.heading}><Text style={[s.panelTitle, { color: c.ink }]}>مكتبة الصور المرفوعة</Text><Pressable oasisKind="plain" onPress={() => void loadLibrary()} disabled={libraryBusy || busy} style={s.stepButton}><RotateCcw size={18} color={c.primary} /></Pressable></View><Text style={[s.small, { color: c.muted }]}>اختر صورة لخلفية {LABELS[slot]}، ثم اضغط «تطبيق الخلفية للجميع».</Text><View style={s.library}>{library.map(item => {
      const path = `backgrounds/${item.name}`;
      const used = BACKGROUND_SLOTS.filter(key => backgrounds[key].path === path);
      return <View key={item.name} style={[s.libraryItem, { borderColor: c.line }]}><Pressable oasisKind="plain" disabled={busy} accessibilityLabel={`استخدام الصورة ${item.name}`} onPress={() => { setDrafts(previous => ({ ...previous, [slot]: { setting: { ...draft.setting, path } } })); setNotice(null); }}><Image source={{ uri: imageUrl(path) }} style={s.libraryImage} /><View style={s.libraryCaption}><Text style={[s.small, { color: c.primary }]}>{used.length ? used.map(key => LABELS[key]).join(' · ') : 'اختيار هذه الصورة'}</Text>{draft.setting.path === path && !draft.file ? <Check size={16} color={c.primary} /> : null}</View></Pressable><Pressable oasisKind="plain" disabled={busy || used.length > 0} accessibilityLabel={`حذف الصورة ${item.name}`} onPress={() => removeImage(item)} style={s.restore}><Trash2 size={15} color={used.length ? c.muted : c.danger} /><Text style={[s.small, { color: used.length ? c.muted : c.danger }]}>{used.length ? 'مستخدمة حاليًا' : 'حذف من المكتبة'}</Text></Pressable></View>;
    })}</View>{libraryBusy ? <ActivityIndicator color={c.primary} /> : library.length === 0 ? <Text style={[s.empty, { color: c.muted }]}>لم ترفع صورًا بعد. اختر صورة وطبّقها لتظهر هنا.</Text> : null}{hasMore ? <Pressable oasisKind="plain" disabled={libraryBusy || busy} onPress={() => void loadLibrary(nextOffset)} style={s.restore}><Text style={{ color: c.primary }}>تحميل صور أقدم</Text></Pressable> : null}</View> : null}
    <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}><View style={s.fullPreview}><Pressable oasisKind="plain" accessibilityLabel="إغلاق معاينة الخلفية" onPress={() => setPreviewOpen(false)} style={s.previewClose}><X size={24} color="#FFFFFF" /></Pressable><Image source={preview} resizeMode="contain" style={{ flex: 1, width: '100%' }} /></View></Modal>
  </View>;
}

const s = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: 14 },
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'right' },
  panelTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  description: { fontSize: 12, lineHeight: 22, textAlign: 'right' },
  slots: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  slot: { flex: 1, minWidth: 110, minHeight: 50, padding: 8, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  slotTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  dirtyDot: { width: 5, height: 5, borderRadius: 3 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 13 },
  status: { fontSize: 10, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  preview: { height: 215, borderRadius: 15, overflow: 'hidden' },
  previewBadge: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row-reverse', gap: 6, backgroundColor: 'rgba(6,30,20,.76)', padding: 9, borderRadius: 12 },
  whiteSmall: { color: '#FFFFFF', fontSize: 11 },
  actions: { flexDirection: 'row-reverse', gap: 8 },
  secondary: { flex: 1, minHeight: 46, borderRadius: 13, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  buttonText: { fontSize: 12, fontWeight: '700' },
  small: { fontSize: 10, lineHeight: 18, textAlign: 'right' },
  opacityRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  opacityLabel: { fontSize: 11, textAlign: 'right', flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stepButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  percent: { minWidth: 38, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  notice: { padding: 12, borderRadius: 12 },
  primary: { backgroundColor: '#047857', minHeight: 48, borderRadius: 24, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9 },
  restore: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  library: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  libraryItem: { width: '48%', borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  libraryImage: { height: 130, width: '100%', resizeMode: 'cover' },
  libraryCaption: { minHeight: 32, paddingHorizontal: 9, paddingTop: 6, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  empty: { fontSize: 12, paddingVertical: 24, textAlign: 'center', lineHeight: 22 },
  fullPreview: { flex: 1, backgroundColor: 'rgba(3,12,7,.96)', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 30 },
  previewClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 24, backgroundColor: 'rgba(255,255,255,.12)', marginBottom: 10 },
});
