import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BadgeCheck, Mail, Send, ShieldCheck } from 'lucide-react-native';
import AppHeader from '@/components/shared/AppHeader';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { PLATFORM_NAME } from '@/lib/platformMessages';

type Welcome = { enabled: boolean; title: string; body: string };
type Campaign = { id: string; title: string | null; recipient_count: number; created_at: string };
export default function AdminBroadcastScreen() {
  const { colors: c } = useTheme();
  const bottom = useBottomNavInset();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<'welcome' | 'campaign'>('welcome');
  const [welcome, setWelcome] = useState<Welcome>({ enabled: true, title: '', body: '' });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'update' | 'announcement' | 'system'>('update');
  const [audience, setAudience] = useState<'all' | 'new' | 'user'>('all');
  const [username, setUsername] = useState('');
  const [history, setHistory] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const lock = useRef(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const load = useCallback(async () => {
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('هذه الصفحة متاحة لإدارة المنصة فقط.');
      const { data: profile, error: roleError } = await supabase.from('profiles').select('role,is_banned').eq('id', user.id).single();
      if (roleError) throw roleError;
      if (profile.role !== 'admin' || profile.is_banned) throw new Error('هذه الصفحة متاحة لإدارة المنصة فقط.');
      setAllowed(true);
      const [settings, campaigns] = await Promise.all([
        supabase.from('platform_welcome_settings').select('enabled,title,body').eq('id', 'welcome').single(),
        supabase.from('platform_campaigns').select('id,title,recipient_count,created_at').order('created_at', { ascending: false }).limit(15),
      ]);
      if (settings.error) throw settings.error;
      if (campaigns.error) throw campaigns.error;
      setWelcome(settings.data); setHistory(campaigns.data || []);
    } catch (e) { setError(String((e as { message?: string })?.message || 'تعذر تحميل مركز التواصل.')); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    if (lock.current) return;
    const message = tab === 'welcome' ? welcome.body : body;
    if (!message.trim()) { setError('اكتب محتوى الرسالة أولًا.'); return; }
    if (tab === 'welcome' && !welcome.title.trim()) { setError('أضف عنوانًا للترحيب.'); return; }
    if (tab === 'campaign' && audience === 'user' && !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim().replace(/^@/, ''))) { setError('أدخل معرف مستخدم صحيحًا.'); return; }
    lock.current = true; setBusy(true); setError(''); setResult('');
    try {
      if (tab === 'welcome') {
        const { error: saveError } = await supabase.from('platform_welcome_settings').update({ ...welcome, title: welcome.title.trim(), body: welcome.body.trim(), updated_at: new Date().toISOString() }).eq('id', 'welcome');
        if (saveError) throw saveError;
        setResult(welcome.enabled ? 'تم تفعيل الترحيب التلقائي للحسابات الجديدة دون إرسال يدوي.' : 'تم حفظ الرسالة وإيقاف الترحيب التلقائي.');
      } else {
        const fingerprint = JSON.stringify([title.trim(), body.trim(), type, audience, username.trim().replace(/^@/, '').toLowerCase()]);
        if (request.current?.fingerprint !== fingerprint) {
          const { data: id, error: idError } = await supabase.rpc('platform_campaign_request_id');
          if (idError) throw idError;
          request.current = { fingerprint, id: id as string };
        }
        const { data, error: sendError } = await supabase.rpc('send_platform_campaign', { p_title: title.trim(), p_body: body.trim(), p_type: type, p_audience: audience, p_username: username.trim(), p_request_id: request.current!.id });
        if (sendError) throw sendError;
        setResult(`تم تسليم الرسالة إلى ${data} حساب من حساب ${PLATFORM_NAME}.`);
        setTitle(''); setBody(''); request.current = null;
        const { data: recent } = await supabase.from('platform_campaigns').select('id,title,recipient_count,created_at').order('created_at', { ascending: false }).limit(15);
        setHistory(recent || []);
      }
    } catch (e) { setError(String((e as { message?: string })?.message || 'تعذر إتمام العملية. يمكنك إعادة المحاولة.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const previewTitle = tab === 'welcome' ? welcome.title : title;
  const previewBody = tab === 'welcome' ? welcome.body : body;
  const card = [s.card, { backgroundColor: c.surface, borderColor: c.line }];
  const input = [s.input, { color: c.ink, backgroundColor: c.background, borderColor: c.line }];
  return <View style={{ flex: 1, backgroundColor: c.background }}>
    <AppHeader variant="sub" title="مركز تواصل المنصة" subtitle="ترحيب تلقائي وتحديثات رسمية" fallbackRoute="/admin" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: bottom + 24 }]}>
      {!ready ? <ActivityIndicator color={c.primary} /> : null}
      {error ? <View accessibilityRole="alert" style={[s.card, { backgroundColor: c.dangerSoft }]}><Text style={{ color: c.danger, textAlign: 'right' }}>{error}</Text><Pressable onPress={() => void load()}><Text style={{ color: c.primary }}>إعادة تحميل</Text></Pressable></View> : null}
      {ready && allowed ? <>
        <View style={card}><View style={s.row}><ShieldCheck size={28} color={c.primary} /><View style={{ flex: 1, gap: 5 }}><Text style={[s.heading, { color: c.ink }]}>{PLATFORM_NAME} <BadgeCheck size={16} color={c.primary} /></Text><Text style={[s.note, { color: c.muted }]}>هوية رسمية للترحيب وأخبار المنصة، داخل محادثة خاصة لكل مستخدم.</Text></View></View></View>
        <View style={s.row}>{(['welcome', 'campaign'] as const).map(key => <Pressable key={key} oasisKind="action" oasisVariant={tab === key ? 'primary' : 'secondary'} accessibilityState={{ selected: tab === key }} onPress={() => { setTab(key); setError(''); setResult(''); }} style={{ flex: 1 }}><Text style={{ color: tab === key ? '#fff' : c.primary, fontWeight: '700' }}>{key === 'welcome' ? 'الترحيب التلقائي' : 'رسالة وتحديث جديد'}</Text></Pressable>)}</View>
        <View style={card}>
          <Text style={[s.heading, { color: c.ink }]}>{tab === 'welcome' ? 'رحّب بكل جار جديد' : 'شارك جديد المنصة'}</Text>
          {tab === 'welcome' ? <View style={s.row}><Switch accessibilityLabel="تفعيل الترحيب التلقائي" value={welcome.enabled} onValueChange={enabled => setWelcome(v => ({ ...v, enabled }))} /><Text style={[s.note, { flex: 1, color: c.muted }]}>يُرسل مرة واحدة عند إنشاء الحساب، ويشمل التسجيل بالبريد أو الحسابات الاجتماعية.</Text></View> : <>
            <View style={s.row}>{([['update', 'تحديث'], ['announcement', 'إعلان'], ['system', 'تنبيه']] as const).map(([key, label]) => <Pressable key={key} oasisKind="chip" oasisVariant={type === key ? 'primary' : 'secondary'} accessibilityState={{ selected: type === key }} onPress={() => setType(key)}><Text style={{ color: type === key ? '#fff' : c.primary }}>{label}</Text></Pressable>)}</View>
            <Text style={[s.label, { color: c.ink }]}>الجمهور</Text><View style={[s.row, { flexWrap: 'wrap' }]}>{([['all', 'الجميع'], ['new', 'الجدد · آخر ٧ أيام'], ['user', 'مستخدم محدد']] as const).map(([key, label]) => <Pressable key={key} oasisKind="chip" oasisVariant={audience === key ? 'primary' : 'secondary'} accessibilityState={{ selected: audience === key }} onPress={() => setAudience(key)}><Text style={{ color: audience === key ? '#fff' : c.primary }}>{label}</Text></Pressable>)}</View>
            {audience === 'user' ? <TextInput accessibilityLabel="معرف المستلم" value={username} onChangeText={setUsername} placeholder="@username" autoCapitalize="none" style={input} /> : null}
          </>}
          <Text style={[s.label, { color: c.ink }]}>عنوان الرسالة</Text><TextInput accessibilityLabel="عنوان الرسالة" maxLength={160} value={previewTitle} onChangeText={value => tab === 'welcome' ? setWelcome(v => ({ ...v, title: value })) : setTitle(value)} style={input} placeholder="عنوان واضح ومختصر" />
          <Text style={[s.label, { color: c.ink }]}>محتوى الرسالة</Text><TextInput accessibilityLabel="محتوى الرسالة" multiline maxLength={5000} value={previewBody} onChangeText={value => tab === 'welcome' ? setWelcome(v => ({ ...v, body: value })) : setBody(value)} style={[input, { minHeight: 150, paddingTop: 12, textAlignVertical: 'top' }]} placeholder="اكتب رسالتك هنا…" />
          <Text style={[s.note, { color: c.muted }]}>{previewBody.length} / 5000</Text>
          <Pressable oasisKind="action" oasisVariant="primary" disabled={busy} onPress={() => void submit()} style={s.row}>{busy ? <ActivityIndicator color="#fff" /> : tab === 'welcome' ? <Mail size={18} color="#fff" /> : <Send size={18} color="#fff" />}<Text style={{ color: '#fff', fontWeight: '700' }}>{tab === 'welcome' ? 'حفظ إعدادات الترحيب' : 'نشر الرسالة الآن'}</Text></Pressable>
          {result ? <Text accessibilityRole="alert" style={[s.note, { color: c.primary }]}>{result}</Text> : null}
        </View>
        <View style={card}><Text style={[s.label, { color: c.muted }]}>معاينة الرسالة لدى المستخدم</Text><Text style={[s.heading, { color: c.primary }]}>{PLATFORM_NAME} ✓</Text><Text style={[s.heading, { color: c.ink }]}>{previewTitle || 'عنوان الرسالة'}</Text><Text style={[s.preview, { color: c.ink }]}>{previewBody || 'تظهر رسالتك هنا قبل النشر.'}</Text></View>
        <View style={card}><Text style={[s.heading, { color: c.ink }]}>سجل الإرسال</Text>{history.length ? history.map(item => <View key={item.id} style={[s.history, { borderColor: c.line }]}><Text style={[s.label, { color: c.ink }]}>{item.title || 'رسالة رسمية'}</Text><Text style={[s.note, { color: c.muted }]}>{item.recipient_count} مستلم · {new Date(item.created_at).toLocaleString('ar-SA')}</Text></View>) : <Text style={[s.note, { color: c.muted }]}>ستظهر حملاتك هنا بعد نشر أول رسالة.</Text>}</View>
      </> : null}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  content: { padding: 16, gap: 14, width: '100%', maxWidth: 900, alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 }, row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, justifyContent: 'center' },
  heading: { fontSize: 17, fontWeight: '700', textAlign: 'right' }, note: { fontSize: 12, lineHeight: 20, textAlign: 'right' }, label: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, textAlign: 'right' }, preview: { fontSize: 15, lineHeight: 25, textAlign: 'right' },
  history: { paddingVertical: 10, gap: 5, borderTopWidth: 1 },
});
