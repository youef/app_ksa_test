import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { createLiveStream, type LiveStream } from '@/lib/lives';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { Camera, ChevronLeft, LockKeyhole, Radio } from 'lucide-react-native';

const CATEGORIES = ['عام', 'سوالف الحي', 'تجارب ونصائح', 'رياضة', 'طبخ', 'متجر الحي', 'مواهب'];
const AUDIENCES: { key: LiveStream['audience']; title: string; note: string }[] = [
  { key: 'public', title: 'عام', note: 'يظهر لكل مستخدمي حيّنا' },
  { key: 'followers', title: 'متابعوك', note: 'يشاهد البث متابعو حسابك' },
  { key: 'city', title: 'مدينتي', note: 'مخصص لأهالي مدينتك' },
];

export default function CreateLiveScreen() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('عام');
  const [audience, setAudience] = useState<LiveStream['audience']>('public');
  const [starting, setStarting] = useState(false);

  async function startLive() {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) { Alert.alert('أضف عنوانًا', 'اكتب عنوانًا من 3 أحرف على الأقل حتى يعرف الجيران موضوع البث.'); return; }
    setStarting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول لبدء بث مباشر.'); router.push('/auth'); return; }
      if (audience === 'city') {
        const { data: profile } = await supabase.from('profiles').select('city').eq('id', auth.user.id).maybeSingle();
        if (!profile?.city) { Alert.alert('أكمل مدينتك أولاً', 'أضف مدينتك إلى ملفك الشخصي قبل اختيار بث المدينة.'); return; }
      }
      const stream = await createLiveStream({ title: cleanTitle.slice(0, 100), category, audience });
      router.replace({ pathname: '/live/[id]', params: { id: stream.id, role: 'host' } });
    } catch (error) {
      Alert.alert('تعذر بدء البث', error instanceof Error ? error.message : 'حاول مرة أخرى بعد قليل.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="تجهيز البث" subtitle="أكمل التفاصيل ثم ابدأ مباشرة" fallbackRoute="/lives" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}><Camera size={20} color={OASIS.colors.primary} /><Text style={styles.noticeText}>قبل البث سنطلب إذن الكاميرا والميكروفون. تستطيع إيقافهما من داخل الغرفة.</Text></View>
        <Text style={styles.label}>عنوان البث</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="وش ودك تشارك جيرانك؟" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" />
        <Text style={styles.counter}>{title.length}/100</Text>

        <Text style={styles.label}>التصنيف</Text>
        <View style={styles.chipWrap}>{CATEGORIES.map((item) => <Pressable oasisVariant={category === item ? 'primary' : 'secondary'} oasisKind="chip" key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>

        <Text style={styles.label}>من يشاهد بثك؟</Text>
        <View style={{ gap: 9 }}>{AUDIENCES.map((item) => <Pressable key={item.key} onPress={() => setAudience(item.key)} style={[styles.audience, audience === item.key && styles.audienceActive]}><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.audienceTitle}>{item.title}</Text><Text style={styles.audienceNote}>{item.note}</Text></View><View style={[styles.radio, audience === item.key && styles.radioActive]}>{audience === item.key && <View style={styles.radioDot} />}</View></Pressable>)}</View>

        <View style={styles.privacy}><LockKeyhole size={16} color={OASIS.colors.muted} /><Text style={styles.privacyText}>لا نعرض موقعك الدقيق. اختر جمهورًا آمنًا، واستخدم أدوات الحظر والإبلاغ عند الحاجة.</Text></View>
        <Pressable oasisKind="action" disabled={starting} onPress={() => void startLive()} style={[styles.startButton, starting && { opacity: 0.7 }]}>
          {starting ? <ActivityIndicator color={OASIS.colors.surface} /> : <><Radio size={18} color={OASIS.colors.surface} /><Text style={styles.startText}>ابدأ البث الآن</Text><ChevronLeft size={18} color={OASIS.colors.surface} /></>}
        </Pressable>
        <Text style={styles.footerNote}>عند الضغط على «ابدأ» ستدخل غرفة البث مباشرة.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' }, content: { padding: 18, paddingBottom: 24 },
  notice: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, backgroundColor: OASIS.colors.soft, borderRadius: 16, marginBottom: 14 }, noticeText: { flex: 1, color: OASIS.colors.deep, fontSize: 12, textAlign: 'right', lineHeight: 19, fontWeight: '600' },
  label: { color: OASIS.colors.ink, textAlign: 'right', fontSize: 15, fontWeight: '700', marginBottom: 9, marginTop: 8 }, input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: OASIS.colors.surface, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: OASIS.colors.ink }, counter: { color: '#94a3b8', fontSize: 11, textAlign: 'left', marginTop: 5, marginBottom: 12 },
  chipWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, chip: { paddingHorizontal: 13, paddingVertical: 9, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14 }, chipActive: { backgroundColor: OASIS.colors.soft, borderColor: OASIS.colors.primary }, chipText: { color: OASIS.colors.muted, fontWeight: '700', fontSize: 12 }, chipTextActive: { color: OASIS.colors.primary },
  audience: { backgroundColor: OASIS.colors.surface, borderRadius: 15, padding: 13, borderWidth: 1, borderColor: OASIS.colors.line, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }, audienceActive: { borderColor: OASIS.colors.primary, backgroundColor: OASIS.colors.soft }, audienceTitle: { color: OASIS.colors.ink, fontWeight: '600', fontSize: 13 }, audienceNote: { color: OASIS.colors.muted, fontSize: 11, marginTop: 3, textAlign: 'right' }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: OASIS.colors.primary }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: OASIS.colors.primary },
  privacy: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 13, marginTop: 18 }, privacyText: { flex: 1, color: OASIS.colors.muted, fontSize: 11, textAlign: 'right', lineHeight: 18 }, startButton: { height: 44, borderRadius: 17, marginTop: 14, backgroundColor: OASIS.colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 }, startText: { color: OASIS.colors.surface, fontSize: 15, fontWeight: '700' }, footerNote: { textAlign: 'center', color: '#94a3b8', fontSize: 11, marginTop: 11 },
});
