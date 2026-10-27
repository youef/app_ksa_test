import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, Megaphone, Trash2, Send, CheckCircle2, Link2 } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import AppHeader from '@/components/shared/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Ad = { id: string; title: string | null; message: string | null; image_url: string | null; expires_at: string; created_at: string; action_type: string; action_target: string | null };
type Format = 'text' | 'mixed' | 'image';

export default function AdminAnnouncements() {
  const { colors: c } = useTheme();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [expandedAd, setExpandedAd] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('text');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState<'none' | 'internal' | 'external'>('none');
  const [target, setTarget] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('home_announcements')
      .select('id,title,message,image_url,expires_at,created_at,action_type,action_target')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setAds((data || []) as Ad[]);
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      const { data: profile } = uid ? await supabase.from('profiles').select('role').eq('id', uid).maybeSingle() : { data: null };
      if (!mounted) return;
      const admin = profile?.role === 'admin';
      setAllowed(admin);
      setChecking(false);
      if (admin) void load();
    })();
    return () => { mounted = false; };
  }, [load]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('إذن الصور', 'اسمح بالوصول إلى الصور لإضافة صورة للإعلان.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [16, 9] });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  }

  async function publish() {
    if (busy) return;
    setError('');
    if (format !== 'image' && !title.trim() && !message.trim()) return setError('اكتب عنوانًا أو رسالة للإعلان.');
    if (format !== 'text' && !photo) return setError('اختر صورة للإعلان أولًا.');
    if (destination === 'internal' && !/^\/[a-zA-Z0-9/_-]+$/.test(target.trim())) return setError('أدخل مسارًا داخليًا صحيحًا مثل /market أو /stories أو /map');
    if (destination === 'external' && !/^https:\/\/[^\s]+$/i.test(target.trim())) return setError('الرابط الخارجي يجب أن يبدأ بـ https://');
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('انتهت الجلسة. سجّل الدخول مجددًا.');
      let imageUrl: string | null = null;
      if (format !== 'text' && photo) {
        const mime = photo.mimeType === 'image/jpeg' || photo.mimeType === 'image/webp' ? photo.mimeType : 'image/png';
        const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
        uploadedPath = `${auth.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const blob = await (await fetch(photo.uri)).blob();
        if (blob.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.');
        const { error: uploadError } = await supabase.storage.from('home-announcements').upload(uploadedPath, blob, { contentType: mime, upsert: false });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from('home-announcements').getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error: insertError } = await supabase.from('home_announcements').insert({
        title: format === 'image' ? null : title.trim() || null,
        message: format === 'image' ? null : message.trim() || null,
        image_url: imageUrl,
        created_by: auth.user.id,
        action_type: destination,
        action_target: destination === 'none' ? null : target.trim(),
      });
      if (insertError) throw insertError;
      setTitle(''); setMessage(''); setPhoto(null); setFormat('text'); setDestination('none'); setTarget('');
      await load();
      Alert.alert('تم النشر', 'الإعلان ظاهر للجميع لمدة 24 ساعة.');
    } catch (e: any) {
      if (uploadedPath) await supabase.storage.from('home-announcements').remove([uploadedPath]).catch(() => {});
      setError(e?.message || 'تعذر نشر الإعلان.');
    } finally { setBusy(false); }
  }

  async function remove(ad: Ad) {
    if (busy) return;
    setBusy(true);
    const { error: deletionError } = await supabase.from('home_announcements').delete().eq('id', ad.id);
    if (deletionError) setError(deletionError.message);
    else {
      setAds(current => current.filter(x => x.id !== ad.id));
      // Images remain in storage until separately cleaned up, avoiding a broken image on a failed DB delete.
    }
    setBusy(false);
  }

  if (checking) return <View style={[s.center, { backgroundColor: c.background }, { backgroundColor: 'transparent' }]}><ActivityIndicator color={c.primary} /></View>;
  if (!allowed) return <View style={[s.center, { backgroundColor: c.background }, { backgroundColor: 'transparent' }]}><Text style={{ color: c.danger }}>هذه الصفحة مخصصة لإدارة المنصة فقط.</Text><Pressable onPress={() => router.replace('/home')}><Text style={{ color: c.primary }}>العودة للرئيسية</Text></Pressable></View>;

  return <View style={[{ flex: 1, backgroundColor: c.background }, { backgroundColor: 'transparent' }]}>
    <AppHeader variant="sub" title="إدارة الإعلانات" subtitle="إعلانات الصفحة الرئيسية · 24 ساعة" fallbackRoute="/admin" />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={[s.panel, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={s.row}><Megaphone color={c.primary} size={22} /><Text style={[s.heading, { color: c.ink }]}>إنشاء إعلان جديد</Text></View>
        <Text style={{ color: c.muted, textAlign: 'right', lineHeight: 21 }}>يظهر لجميع الزوار والأعضاء، ويختفي بعد 24 ساعة. تتناوب الإعلانات كل 30 ثانية.</Text>
        <View style={s.formats}>{([{ key: 'text', label: 'نصي' }, { key: 'mixed', label: 'نص وصورة' }, { key: 'image', label: 'صورة فقط' }] as const).map(option =>
          <Pressable key={option.key} onPress={() => setFormat(option.key)} style={[s.option, { backgroundColor: format === option.key ? c.primary : c.soft }]}>
            <Text style={{ color: format === option.key ? '#FFFFFF' : c.ink, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
          </Pressable>)}</View>
        {format !== 'image' ? <>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان الإعلان (اختياري)" placeholderTextColor={c.muted} maxLength={120} style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.background }]} textAlign="right" />
          <TextInput value={message} onChangeText={setMessage} placeholder="نص الإعلان" placeholderTextColor={c.muted} multiline maxLength={1000} style={[s.input, s.multiline, { color: c.ink, borderColor: c.line, backgroundColor: c.background }]} textAlign="right" />
        </> : null}
        {format !== 'text' ? <Pressable onPress={() => void pickPhoto()} style={[s.photoPicker, { borderColor: c.line, backgroundColor: c.soft }]}>
          {photo ? <Image source={{ uri: photo.uri }} style={s.preview} resizeMode="cover" /> : <ImagePlus size={30} color={c.primary} />}
          <Text style={{ color: c.primary, fontWeight: '700' }}>{photo ? 'تغيير الصورة' : 'اختر صورة للإعلان (حتى 5 ميجابايت)'}</Text>
        </Pressable> : null}
        <View style={s.row}><Link2 size={18} color={c.primary} /><Text style={[s.heading, { color: c.ink, fontSize: 14 }]}>عند الضغط على الإعلان</Text></View>
        <View style={s.formats}>{([{ key: 'none', label: 'بدون انتقال' }, { key: 'internal', label: 'قسم بالتطبيق' }, { key: 'external', label: 'رابط خارجي' }] as const).map(option =>
          <Pressable key={option.key} onPress={() => { setDestination(option.key); setTarget(''); }} style={[s.option, { backgroundColor: destination === option.key ? c.primary : c.soft }]}>
            <Text style={{ color: destination === option.key ? '#FFFFFF' : c.ink, fontSize: 11, fontWeight: '700' }}>{option.label}</Text>
          </Pressable>)}</View>
        {destination === 'internal' ? <View style={s.formats}>{([{ path: '/market', label: 'السوق' }, { path: '/stories', label: 'اليوميات' }, { path: '/map', label: 'الخريطة' }, { path: '/questions', label: 'الاستفسارات' }] as const).map(link =>
          <Pressable key={link.path} onPress={() => setTarget(link.path)} style={[s.option, { backgroundColor: target === link.path ? c.primary : c.soft }]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: target === link.path ? '#FFFFFF' : c.ink }}>{link.label}</Text>
          </Pressable>)}</View> : null}
        {destination !== 'none' ? <TextInput value={target} onChangeText={setTarget} autoCapitalize="none" placeholder={destination === 'external' ? 'https://example.com' : '/market'} placeholderTextColor={c.muted} style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.background }]} textAlign="left" /> : null}
        <Text style={{ color: c.muted, textAlign: 'right', fontSize: 11 }}>مقاس الإعلان العرضي الموصى به: 1200 × 430 بكسل (بنسبة 2.8:1)</Text>
        <View style={[s.panel, { backgroundColor: c.soft, borderColor: c.line }]}>
          <Text style={[s.heading, { color: c.ink, fontSize: 14 }]}>معاينة الإعلان قبل النشر</Text>
          {format !== 'text' && photo ? <Image source={{ uri: photo.uri }} resizeMode="cover" style={s.preview} /> : null}
          {format !== 'image' && title.trim() ? <Text style={{ color: c.ink, textAlign: 'right', fontWeight: '800' }}>{title.trim()}</Text> : null}
          {format !== 'image' && message.trim() ? <Text style={{ color: c.ink, textAlign: 'right', lineHeight: 22 }} numberOfLines={4}>{message.trim()}</Text> : null}
          {destination !== 'none' && target.trim() ? <Text style={{ color: c.primary, textAlign: 'right', fontSize: 12 }}>الانتقال إلى: {target.trim()}</Text> : null}
          <Text style={{ color: c.muted, textAlign: 'right', fontSize: 11 }}>تظهر هذه المعاينة داخل لوحة الإدارة فقط، ولا تنشر الإعلان.</Text>
        </View>
        {error ? <Text style={{ color: c.danger, textAlign: 'right' }}>{error}</Text> : null}
        <Pressable onPress={() => void publish()} disabled={busy} style={[s.submit, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Send color="#FFFFFF" size={18} />}
          <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>نشر الإعلان للجميع</Text>
        </Pressable>
      </View>
      <Text style={[s.heading, { color: c.ink, marginTop: 12 }]}>الإعلانات النشطة ({ads.length})</Text>
      {!ads.length ? <Text style={{ color: c.muted, textAlign: 'right' }}>لا توجد إعلانات نشطة حاليًا.</Text> : null}
      {ads.map(ad => <View key={ad.id} style={[s.panel, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={s.row}><CheckCircle2 size={16} color={c.primary} /><Text style={{ color: c.muted, flex: 1, textAlign: 'right' }}>ينتهي {new Date(ad.expires_at).toLocaleString('ar-SA')}</Text></View>
        <Pressable onPress={() => setExpandedAd(expandedAd === ad.id ? null : ad.id)} style={[s.detailToggle, { backgroundColor: c.soft }]}>
          <Text style={{ color: c.primary, fontWeight: '800' }}>{expandedAd === ad.id ? 'إخفاء تفاصيل الإعلان' : 'عرض تفاصيل الإعلان'}</Text>
        </Pressable>
        {ad.title ? <Text style={[s.heading, { color: c.ink }]}>{ad.title}</Text> : null}
        {ad.image_url ? <Image source={{ uri: ad.image_url }} resizeMode="contain" style={s.preview} /> : null}
        {ad.action_target ? <Text style={{ color: c.primary, textAlign: 'right', fontSize: 11 }}>الوجهة: {ad.action_target}</Text> : null}
        {ad.message ? <Text style={{ color: c.ink, textAlign: 'right', lineHeight: 22 }}>{ad.message}</Text> : null}
        {expandedAd === ad.id ? <View style={[s.panel, { backgroundColor: c.soft, borderColor: c.line }]}>
          <Text style={{ color: c.ink, textAlign: 'right' }}>رقم الإعلان: {ad.id}</Text>
          <Text style={{ color: c.ink, textAlign: 'right' }}>نوع المحتوى: {ad.image_url ? (ad.title || ad.message ? 'صورة ونص' : 'صورة فقط') : 'نص فقط'}</Text>
          <Text style={{ color: c.ink, textAlign: 'right' }}>تاريخ النشر: {new Date(ad.created_at).toLocaleString('ar-SA')}</Text>
          <Text style={{ color: c.ink, textAlign: 'right' }}>الانتهاء: {new Date(ad.expires_at).toLocaleString('ar-SA')}</Text>
          <Text style={{ color: c.ink, textAlign: 'right' }}>الحالة: {new Date(ad.expires_at).getTime() > Date.now() ? 'نشط' : 'منتهي'}</Text>
          <Text style={{ color: c.ink, textAlign: 'right' }}>الإجراء: {ad.action_type === 'internal' ? 'انتقال داخل التطبيق' : ad.action_type === 'external' ? 'رابط خارجي' : 'بدون إجراء'}</Text>
          {ad.action_target ? <Text selectable style={{ color: c.primary, textAlign: 'right' }}>المسار: {ad.action_target}</Text> : null}
        </View> : null}
        <Pressable onPress={() => void remove(ad)} disabled={busy} style={s.delete}><Trash2 size={17} color={c.danger} /><Text style={{ color: c.danger, fontWeight: '700' }}>حذف الإعلان</Text></Pressable>
      </View>)}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  content: { padding: 16, paddingBottom: 100, gap: 12, maxWidth: 740, width: '100%', alignSelf: 'center' },
  panel: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  heading: { fontSize: 17, fontWeight: '800', textAlign: 'right' },
  formats: { flexDirection: 'row-reverse', gap: 7 },
  option: { flex: 1, minHeight: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  photoPicker: { minHeight: 130, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10 },
  preview: { width: '100%', aspectRatio: 2.8, maxHeight: 230, borderRadius: 12 },
  submit: { minHeight: 48, borderRadius: 13, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 9 },
  detailToggle: { alignItems: 'center', padding: 12, borderRadius: 12 },
  delete: { flexDirection: 'row-reverse', gap: 7, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8 },
});
