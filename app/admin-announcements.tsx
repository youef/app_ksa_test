import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ImagePlus, Megaphone, Trash2, Send, X, CheckCircle2 } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import AppHeader from '@/components/shared/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Ad = { id: string; title: string | null; message: string | null; image_url: string | null; expires_at: string; created_at: string };
type Format = 'text' | 'mixed' | 'image';

export default function AdminAnnouncements() {
  const { colors: c } = useTheme();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [format, setFormat] = useState<Format>('text');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('home_announcements')
      .select('id,title,message,image_url,expires_at,created_at')
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
      });
      if (insertError) throw insertError;
      setTitle(''); setMessage(''); setPhoto(null); setFormat('text');
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

  if (checking) return <View style={[s.center, { backgroundColor: c.background }]}><ActivityIndicator color={c.primary} /></View>;
  if (!allowed) return <View style={[s.center, { backgroundColor: c.background }]}><Text style={{ color: c.danger }}>هذه الصفحة مخصصة لإدارة المنصة فقط.</Text><Pressable onPress={() => router.replace('/home')}><Text style={{ color: c.primary }}>العودة للرئيسية</Text></Pressable></View>;

  return <View style={{ flex: 1, backgroundColor: c.background }}>
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
          {photo ? <Image source={{ uri: photo.uri }} style={s.preview} resizeMode="contain" /> : <ImagePlus size={30} color={c.primary} />}
          <Text style={{ color: c.primary, fontWeight: '700' }}>{photo ? 'تغيير الصورة' : 'اختر صورة للإعلان (حتى 5 ميجابايت)'}</Text>
        </Pressable> : null}
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
        {ad.title ? <Text style={[s.heading, { color: c.ink }]}>{ad.title}</Text> : null}
        {ad.image_url ? <Image source={{ uri: ad.image_url }} resizeMode="contain" style={s.preview} /> : null}
        {ad.message ? <Text style={{ color: c.ink, textAlign: 'right', lineHeight: 22 }}>{ad.message}</Text> : null}
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
  preview: { width: '100%', height: 185, borderRadius: 12 },
  submit: { minHeight: 48, borderRadius: 13, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 9 },
  delete: { flexDirection: 'row-reverse', gap: 7, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8 },
});
