import { AppHeader } from '@/components/shared/AppHeader';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import { UserRound, Settings, Bell, Heart, Store, Map, MessageCircle, ShieldCheck, CircleHelp, ChevronLeft, ChevronDown, LogIn, LogOut, ShoppingBag, Compass, SlidersHorizontal, Share2, Lightbulb, Info, LifeBuoy, X, BadgeCheck, Radio } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { usePlatformConfig } from '@/lib/platformConfig';
import { useBottomNavInset } from '@/lib/bottomNav';
import appConfig from '../app.json';

type Profile = { display_name: string; username: string; avatar_url: string | null; account_type: string; is_verified: boolean; is_verified_merchant: boolean; role: string };
type Item = { title: string; subtitle: string; href?: string; Icon: typeof UserRound; member?: boolean; flag?: string; action?: () => void };
const SERVICES: Item[] = [
  { title: 'سوق الحي', subtitle: 'المنتجات والخدمات القريبة', href: '/market', Icon: ShoppingBag, member: true, flag: 'market' },
  { title: 'دليل الأعمال', subtitle: 'المتاجر ومقدمو الخدمات', href: '/directory', Icon: Store, member: true, flag: 'directory' },
  { title: 'خريطة الحي', subtitle: 'استكشف ما حولك', href: '/map', Icon: Map, flag: 'map' },
  { title: 'الاستفسارات', subtitle: 'أسئلة الجيران وتجاربهم', href: '/questions', Icon: MessageCircle, flag: 'questions' },
  { title: 'البثوث المباشرة', subtitle: 'لقاءات مجتمع حيّنا', href: '/lives', Icon: Radio, member: true, flag: 'live' },
];
const ACCOUNT: Item[] = [
  { title: 'تخصيص الملف الشخصي', subtitle: 'أقسام ملفك وهويته', href: '/profile-customization', Icon: SlidersHorizontal },
  { title: 'الإشعارات', subtitle: 'التنبيهات والتحديثات', href: '/notifications', Icon: Bell },
  { title: 'المفضلة', subtitle: 'العناصر التي حفظتها', href: '/favorites', Icon: Heart },
  { title: 'الإعدادات', subtitle: 'الحساب والتفضيلات', href: '/settings', Icon: Settings },
];
const FAQ = [
  ['ما هو حيّنا؟', 'مجتمع محلي للتواصل مع أهل الحي وتبادل الأسئلة والخدمات والمنتجات.'],
  ['كيف يتم تحديد الحي؟', 'يعتمد على موقع الجهاز بعد إذنك وإعدادات موقع حسابك. يمكنك مراجعة الموقع من الإعدادات.'],
  ['كيف أبلغ عن محتوى مخالف؟', 'افتح قائمة خيارات المحتوى واختر الإبلاغ، ثم اكتب سبب البلاغ.'],
  ['كيف تعمل المفضلة؟', 'احفظ المحتوى من زر المفضلة، ثم ارجع إليه من المفضلة بعد تسجيل الدخول.'],
  ['كيف أتواصل مع الدعم؟', 'سجّل الدخول وافتح مركز الدعم من هذه الصفحة لإنشاء تذكرة ومتابعة الردود.'],
];
const TYPES: Record<string, string> = { standard: 'حساب شخصي', merchant: 'تاجر', freelance: 'مستقل', provider: 'مقدم خدمة', idea: 'صاحب فكرة' };
const normalize = (text: string) => text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[\u064B-\u065F]/g, '');

function Row({ item, last = false }: { item: Item; last?: boolean }) {
  const Icon = item.Icon;
  return <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => item.action ? item.action() : item.href && router.push(item.href as never)} style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}>
    <View style={styles.iconBox}><Icon size={20} color="#047857" /></View>
    <View style={styles.copy}><Text style={styles.title}>{item.title}</Text><Text style={styles.subtitle}>{item.subtitle}</Text></View>
    <ChevronLeft size={18} color="#94a3b8" />
  </Pressable>;
}

export default function MoreScreen() {
  const { flags = {} } = usePlatformConfig(); // Context has defaults even outside the provider.
  const bottomInset = useBottomNavInset(24); // SafeAreaProvider is mounted by app/_layout.
  const [user, setUser] = useState<User | null>(null), [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true), [profileError, setProfileError] = useState(false), [imageFailed, setImageFailed] = useState(false);
  const [search, setSearch] = useState(''), [faq, setFaq] = useState<number | null>(null), [showFaq, setShowFaq] = useState(false);
  const [suggestion, setSuggestion] = useState(false), [idea, setIdea] = useState(''), [sending, setSending] = useState(false), [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState(''), [ideaError, setIdeaError] = useState(''), [shareUrl, setShareUrl] = useState('');
  const generation = useRef(0), busy = useRef(false), currentUser = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let lastId: string | null | undefined;
    const applyUser = async (next: User | null) => {
      if (!active) return;
      setUser(next); currentUser.current = next?.id ?? null;
      if (lastId === (next?.id ?? null)) { setLoading(false); return; }
      lastId = next?.id ?? null;
      const seq = ++generation.current;
      setProfile(null); setImageFailed(false); setProfileError(false);
      if (!next) { setLoading(false); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const { data, error } = await supabase.from('profiles').select('display_name,username,avatar_url,account_type,is_verified,is_verified_merchant,role').eq('id', next.id).abortSignal(controller.signal).maybeSingle();
        if (active && seq === generation.current) { setProfile(error ? null : data); setProfileError(Boolean(error) || !data); }
      } catch { if (active && seq === generation.current) setProfileError(true); }
      finally { clearTimeout(timeout); if (active && seq === generation.current) setLoading(false); }
    };
    // Never await database work from the auth callback (Supabase auth lock).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => { void applyUser(session?.user ?? null); }, 0); });
    const fallback = setTimeout(() => { if (active) setLoading(false); }, 9000);
    void supabase.auth.getSession().then(({ data, error }) => { if (!active || lastId !== undefined) return; if (error) setNotice('تعذر التحقق من الجلسة. يمكنك متابعة التصفح.'); void applyUser(data.session?.user ?? null); }).catch(() => { if (active) { setLoading(false); setNotice('تعذر التحقق من الجلسة. حاول مجددًا لاحقًا.'); } });
    return () => { active = false; generation.current++; clearTimeout(fallback); listener.subscription.unsubscribe(); };
  }, []);
  const name = profile?.display_name || profile?.username || 'حسابك في حيّنا';
  const match = (item: Item) => !search.trim() || normalize(`${item.title} ${item.subtitle}`).includes(normalize(search.trim()));
  const services = SERVICES.filter(item => (!item.member || Boolean(user)) && (!item.flag || flags[item.flag] !== false));
  const account: Item[] = user ? ACCOUNT : [];
  const help: Item[] = [
    { title: 'مركز الدعم والمساعدة', subtitle: user ? 'تذاكرك والتواصل مع الفريق' : 'تواصل مع فريق حيّنا', href: user ? '/support' : '/contact-us', Icon: LifeBuoy },
    { title: 'الأسئلة الشائعة', subtitle: 'إجابات سريعة', Icon: CircleHelp, action: () => setShowFaq(value => !value) },
    { title: 'الخصوصية والأمان', subtitle: user ? 'ظهور الحساب والتواصل' : 'سجّل الدخول لإدارة خصوصيتك', href: user ? '/settings?section=privacy' : '/auth', Icon: ShieldCheck },
    { title: 'حول حيّنا', subtitle: 'تعرّف على التطبيق', href: '/about', Icon: Info },
  ];
  const signOut = async () => {
    if (busy.current) return; busy.current = true; setSigningOut(true); setNotice('');
    try {
      const { error } = await supabase.auth.signOut(); if (error) throw error;
      generation.current++; setUser(null); setProfile(null); setIdea(''); setSuggestion(false); setSearch('');
      router.replace('/auth');
    } catch { setNotice('تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.'); }
    finally { busy.current = false; setSigningOut(false); }
  };
  const sendIdea = async () => {
    if (busy.current) return;
    if (idea.trim().length < 3) { setIdeaError('اكتب اقتراحًا من 3 أحرف على الأقل.'); return; }
    if (!user) { setSuggestion(false); router.push('/auth'); return; }
    busy.current = true; setSending(true); setIdeaError('');
    const senderId = user.id;
    try {
      const { error } = await supabase.from('support_tickets').insert({ user_id: senderId, name, email: user.email || null, subject: 'اقتراح فكرة لحيّنا', message: idea.trim() });
      if (error) throw error;
      if (currentUser.current !== senderId) return;
      setSuggestion(false); setIdea(''); setNotice('شكرًا لك، وصل اقتراحك. يمكنك متابعته من مركز الدعم.');
    } catch { setIdeaError('تعذر إرسال الاقتراح. تحقق من الاتصال وحاول مجددًا.'); }
    finally { busy.current = false; setSending(false); }
  };
  const share = async () => {
    const url = 'https://appksatest.vercel.app'; // Production domain verified against Vercel.
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'حيّنا', text: 'مجتمعك أقرب إليك', url });
        else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setNotice('تم نسخ رابط حيّنا.'); }
        else setShareUrl(url);
      } else await Share.share({ title: 'حيّنا', message: `حيّنا · مجتمعك أقرب إليك\n${url}`, url });
    } catch (error) { if ((error as { name?: string })?.name !== 'AbortError') { setShareUrl(url); setNotice('يمكنك نسخ رابط التطبيق أدناه.'); } }
  };
  const actions: Item[] = [
    { title: 'مشاركة حيّنا', subtitle: 'ادعُ جيرانك للانضمام', Icon: Share2, action: () => { void share(); } },
    ...(user ? [{ title: 'اقترح فكرة لحيّنا', subtitle: 'رأيك يساعدنا على التطوير', Icon: Lightbulb, action: () => { setIdeaError(''); setSuggestion(true); } }] : []),
  ];
  const admin: Item[] = profile?.role === 'admin' ? [{ title: 'لوحة الإدارة', subtitle: 'إدارة المنصة والصلاحيات', href: '/admin', Icon: ShieldCheck }, { title: 'دعم الإدارة', subtitle: 'إدارة تذاكر المستخدمين', href: '/admin-support', Icon: LifeBuoy }] : [];
  const groups = [{ title: 'خدمات حيّنا', items: services }, { title: 'حسابي', items: account }, { title: 'الدعم والخصوصية', items: help }, { title: 'شاركنا', items: actions }, { title: 'الإدارة', items: admin }].map(group => ({ ...group, items: group.items.filter(match) })).filter(group => group.items.length);
  const profileVisible = !search.trim() || match({ title: 'الملف الشخصي', subtitle: name, Icon: UserRound });
  return <View style={styles.screen}>
    <AppHeader variant="tab" title="المزيد" subtitle="حيّنا أقرب إليك" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: 110 + bottomInset }]} showsVerticalScrollIndicator={false}>
      {profileVisible && <Pressable accessibilityRole="button" accessibilityLabel={user ? 'فتح الملف الشخصي' : 'تسجيل الدخول'} onPress={() => router.push(user ? '/profile' : '/auth')} style={styles.hero}>
        <View style={styles.avatar}>{loading ? <ActivityIndicator color="#047857" /> : profile?.avatar_url && !imageFailed ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} onError={() => setImageFailed(true)} /> : <UserRound size={28} color="#047857" />}</View>
        <View style={styles.copy}><Text style={styles.heroTitle}>{loading ? 'جارٍ تحميل حسابك…' : user ? name : 'أهلًا بك في حيّنا'}</Text><Text style={styles.subtitle}>{user ? TYPES[profile?.account_type || ''] || 'حساب حيّنا' : 'تصفّح المجتمع أو سجّل الدخول للمزيد'}</Text>{user && (profile?.is_verified || profile?.is_verified_merchant) && <View style={styles.inline}><BadgeCheck size={14} color="#047857" /><Text style={styles.green}>حساب موثّق</Text></View>}{user && profileError && <Text style={styles.subtitle}>بيانات الحساب غير متاحة مؤقتًا</Text>}{!user && !loading && <Text style={styles.green}>تسجيل الدخول</Text>}</View><ChevronLeft size={20} color="#94a3b8" />
      </Pressable>}
      <View style={styles.search}><Compass size={19} color="#64748b" /><TextInput accessibilityLabel="البحث في المزيد" value={search} onChangeText={setSearch} placeholder="ابحث في المزيد" style={styles.searchInput} />{search ? <Pressable accessibilityRole="button" accessibilityLabel="مسح البحث" onPress={() => setSearch('')}><X size={18} color="#64748b" /></Pressable> : null}</View>
      {notice ? <View accessibilityLiveRegion="polite" style={styles.message}><Text style={styles.body}>{notice}</Text><Pressable accessibilityLabel="إغلاق التنبيه" onPress={() => setNotice('')}><X size={17} color="#64748b" /></Pressable></View> : null}
      {shareUrl ? <Text selectable style={styles.body}>{shareUrl}</Text> : null}
      {!groups.length && !profileVisible && <Text style={styles.empty}>لا توجد نتائج. جرّب كلمة أخرى.</Text>}
      {groups.map(group => <View key={group.title}><Text style={styles.sectionTitle}>{group.title}</Text><View style={styles.card}>{group.items.map((item, index) => <Row key={item.title} item={item} last={index === group.items.length - 1} />)}</View></View>)}
      {showFaq && <View style={styles.card}>{FAQ.map(([question, answer], index) => <View key={question}><Pressable accessibilityRole="button" accessibilityState={{ expanded: faq === index }} onPress={() => setFaq(faq === index ? null : index)} style={styles.row}><Text style={[styles.title, { flex: 1 }]}>{question}</Text><ChevronDown size={18} color="#047857" /></Pressable>{faq === index && <Text style={styles.answer}>{answer}</Text>}</View>)}</View>}
      {user && (!search.trim() || normalize('تسجيل الخروج').includes(normalize(search.trim()))) && <Pressable accessibilityRole="button" disabled={signingOut} onPress={() => { void signOut(); }} style={styles.logout}>{signingOut ? <ActivityIndicator color="#b91c1c" /> : <LogOut size={19} color="#b91c1c" />}<Text style={styles.logoutText}>{signingOut ? 'جارٍ تسجيل الخروج…' : 'تسجيل الخروج'}</Text></Pressable>}
      <Text style={styles.footer}>حيّنا · مجتمعك أقرب إليك{appConfig?.expo?.version ? ` · ${appConfig.expo.version}` : ''}</Text>
    </ScrollView>
    <Modal visible={suggestion} transparent animationType="fade" onRequestClose={() => { if (!sending) setSuggestion(false); }}>
      <View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.heading}>اقترح فكرة لحيّنا</Text><Text style={styles.subtitle}>شاركنا فكرة تجعل تجربة جيرانك أفضل</Text><TextInput accessibilityLabel="نص الاقتراح" multiline maxLength={2000} editable={!sending} value={idea} onChangeText={setIdea} placeholder="اكتب فكرتك هنا…" style={styles.textarea} /><Text style={styles.subtitle}>{idea.length} / 2000</Text>{ideaError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{ideaError}</Text> : null}<View style={styles.buttons}><Pressable accessibilityRole="button" disabled={sending || idea.trim().length < 3} onPress={() => { void sendIdea(); }} style={[styles.send, (sending || idea.trim().length < 3) && { opacity: 0.5 }]}>{sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>إرسال</Text>}</Pressable><Pressable accessibilityRole="button" disabled={sending} onPress={() => setSuggestion(false)} style={styles.cancel}><Text style={styles.title}>إلغاء</Text></Pressable></View></ScrollView></View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f8f7' },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 34 : 20, paddingBottom: 16, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  heading: { color: '#0f172a', fontSize: 23, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16 },
  hero: { backgroundColor: '#fff', borderRadius: 22, padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e5eee9' },
  avatar: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 58, height: 58 }, heroTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  copy: { flex: 1, alignItems: 'flex-end' }, title: { color: '#0f172a', fontSize: 14, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: '#64748b', fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  green: { color: '#047857', fontSize: 12, fontWeight: '700', marginTop: 5 }, inline: { flexDirection: 'row-reverse', gap: 5, alignItems: 'center' },
  search: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#eaf0ed', marginBottom: 20 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 14, color: '#0f172a', textAlign: 'right', writingDirection: 'rtl' },
  sectionTitle: { color: '#475569', fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 9, marginRight: 8 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e8eeeb', marginBottom: 22 },
  row: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: '#f0f4f2' }, pressed: { backgroundColor: '#f0f7f3' },
  iconBox: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, color: '#334155', fontSize: 13, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  message: { padding: 14, backgroundColor: '#ecfdf5', borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 16 },
  answer: { paddingHorizontal: 18, paddingBottom: 18, color: '#475569', fontSize: 13, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' },
  empty: { color: '#64748b', textAlign: 'center', padding: 24 }, logout: { minHeight: 52, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 10 }, logoutText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  footer: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 25 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 24, padding: 22, width: '100%', maxWidth: 480, maxHeight: '85%' },
  textarea: { minHeight: 150, borderWidth: 1, borderColor: '#dce5df', backgroundColor: '#f8faf9', borderRadius: 14, padding: 14, marginTop: 20, color: '#0f172a', fontSize: 15, textAlign: 'right', writingDirection: 'rtl', textAlignVertical: 'top' },
  buttons: { flexDirection: 'row-reverse', gap: 12, marginTop: 18 }, send: { flex: 1, minHeight: 48, backgroundColor: '#047857', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, sendText: { color: '#fff', fontWeight: '700' }, cancel: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#f1f5f3', alignItems: 'center', justifyContent: 'center' }, error: { color: '#b91c1c', fontSize: 13, textAlign: 'right', marginTop: 10 },
});
