import { OasisPressable as Pressable, OasisSurface, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { usePlatformConfig } from '@/lib/platformConfig';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ChevronLeft,
  CircleHelp,
  Info,
  LifeBuoy,
  Map,
  MessageCircle,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  LogOut,
  FileText,
  Mail,
  GraduationCap,
  Images,
} from 'lucide-react-native';

import { AppHeader } from '@/components/shared/AppHeader';
import { AccountIdentityBadge } from '@/components/profile/AccountIdentityBadge';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';

type MenuItem = {
  title: string;
  subtitle: string;
  href: string;
  Icon: any;
  adminOnly?: boolean;
};

const DISCOVER: MenuItem[] = [
  { title: 'سوق الحي', subtitle: 'المنتجات والخدمات والمنشآت', href: '/market', Icon: ShoppingBag },
  { title: 'خريطة الحي', subtitle: 'اكتشف ما حولك على خريطة حيّنا', href: '/map', Icon: Map },
  { title: 'توصيل المدارس', subtitle: 'اطلب توصيلًا أو شارك مقاعد مع أولياء الأمور', href: '/carpooling', Icon: GraduationCap },
  { title: 'الاستفسارات', subtitle: 'أسئلة وتجارب أهل الحي', href: '/questions', Icon: MessageCircle },
  { title: 'دليل الأعمال', subtitle: 'المنشآت ومقدمو الخدمات', href: '/directory', Icon: Store },
  { title: 'البثوث المباشرة', subtitle: 'لقاءات ومحتوى المجتمع', href: '/lives', Icon: Radio },
];

const HELP: MenuItem[] = [
  { title: 'حساب منصة حيّنا', subtitle: 'رسائلك الرسمية وآخر تحديثات المنصة', href: '/platform-inbox', Icon: ShieldCheck },
  { title: 'الدعم والمساعدة', subtitle: 'التواصل مع فريق حيّنا وتذاكرك', href: '/support', Icon: LifeBuoy },
  { title: 'الشروط والسياسات', subtitle: 'حقوقك وخصوصيتك وإرشادات المجتمع', href: '/terms', Icon: FileText },
  { title: 'حول حيّنا', subtitle: 'معلومات المنصة والسياسات', href: '/about', Icon: Info },
];

export default function More() {
  const { colors, isDark } = useTheme();
  const bottomInset = useBottomNavInset();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const { flags } = usePlatformConfig();

  useEffect(() => {
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        setUserId(auth.user.id);
        const { data } = await supabase
          .from('profiles')
          .select('id,display_name,username,avatar_url,role,account_type,is_verified,freelance_trade')
          .eq('id', auth.user.id)
          .maybeSingle();
        setProfile(data || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const accountName = profile?.account_type === 'merchant' && profile?.freelance_trade
    ? profile.freelance_trade
    : profile?.display_name || profile?.username || 'حسابي';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, { backgroundColor: 'transparent' }]}>
      <AppHeader variant="tab" title="المزيد" subtitle="حسابك وخدمات حيّك في مكان واحد" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable oasisKind="card"
          style={[styles.accountCard, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}
          onPress={() => router.push(profile ? '/profile' : '/auth')}
          accessibilityRole="button"
        >
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <UserRound size={24} color="#0F766E" />
            )}
          </View>
          <View style={styles.accountCopy}>
            {loading ? (
              <ActivityIndicator size="small" color={OASIS.colors.primary} />
            ) : (
              <>
                <Text style={styles.accountTitle}>{profile ? accountName : 'سجّل دخولك إلى حيّنا'}</Text>
                <Text style={styles.accountSub}>
                  {profile ? 'إدارة الملف، المحتوى، الهوية والإعدادات' : 'احفظ نشاطك وشارك أهل الحي'}
                </Text>
                {profile ? (
                  <View style={styles.badges}>
                    <AccountIdentityBadge role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} compact />
                  </View>
                ) : null}
              </>
            )}
          </View>
          <ChevronLeft size={19} color="#94A3B8" />
        </Pressable>

        <TextInput accessibilityLabel="البحث في الخدمات والإعدادات" value={query} onChangeText={setQuery} placeholder="ابحث عن خدمة أو إعداد…" style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface, color: colors.ink, textAlign: 'right' }} />
        <MenuGroup title="استكشف حيّنا" query={query} items={DISCOVER.filter(item => !((item.href === '/lives' && flags.live === false) || (item.href === '/market' && flags.market === false) || (item.href === '/map' && flags.map === false) || (item.href === '/directory' && flags.directory === false) || (item.href === '/questions' && flags.questions === false) || (item.href === '/carpooling' && flags.carpooling === false)))} />

        <MenuGroup
          title="المساعدة"
          query={query}
          items={[
            ...HELP.map((item) => profile || item.href !== '/support' ? item : { ...item, href: '/contact-us' }),
            ...(profile?.role === 'admin'
              ? [
                  { title: 'لوحة الإدارة', subtitle: 'إدارة المنصة والصلاحيات', href: '/admin', Icon: ShieldCheck },
                  { title: 'صور وخلفيات الصفحات', subtitle: 'تغيير خلفيات الترحيب والدخول والتطبيق', href: '/admin-backgrounds', Icon: Images },
                  { title: 'إدارة الفلترة والمخالفين', subtitle: 'الكلمات المحظورة والمتابعات', href: '/admin-moderation', Icon: FileText },
                  { title: 'مركز تواصل المنصة', subtitle: 'الترحيب التلقائي والتحديثات الرسمية', href: '/admin-broadcast', Icon: Mail },
                ]
              : []),
          ]}
        />

        {userId ? <View style={styles.logoutWrap}>
          <Pressable
            oasisKind="action"
            oasisVariant="danger"
            style={styles.logoutBtn}
            onPress={() => void (async () => {
              await supabase.auth.signOut();
              router.replace('/auth');
            })()}
          >
            <LogOut size={17} color={OASIS.colors.danger} />
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </Pressable>
        </View> : null}

        <View style={styles.note}>
          <CircleHelp size={17} color={OASIS.colors.muted} />
          <Text style={styles.noteText}>
            إدارة الحساب والإعدادات والتوثيق والمحتوى لم تعد موزعة هنا؛ كلها داخل «حسابي».
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function MenuGroup({ title, items, query = '' }: { title: string; items: MenuItem[]; query?: string }) {
  const { colors, isDark } = useTheme();
  const visible = items.filter(item => `${item.title} ${item.subtitle}`.includes(query.trim()));
  if (!visible.length) return null;
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, isDark && { color: colors.muted }]}>{title}</Text>
      <OasisSurface oasisSurface="card" style={[styles.groupCard, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {visible.map((item, index) => {
          const Icon = item.Icon;
          return (
            <React.Fragment key={item.href + item.title}>
              {index ? <View style={[styles.divider, isDark && { backgroundColor: colors.line }]} /> : null}
              <Pressable style={styles.row} onPress={() => router.push(item.href as any)}>
                <View style={[styles.rowIcon, isDark && { backgroundColor: colors.soft }]}><Icon size={19} color={colors.primary} /></View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, isDark && { color: colors.ink }]}>{item.title}</Text>
                  <Text style={[styles.rowSub, isDark && { color: colors.muted }]}>{item.subtitle}</Text>
                </View>
                <ChevronLeft size={18} color={isDark ? colors.muted : "#CBD5E1"} />
              </Pressable>
            </React.Fragment>
          );
        })}
      </OasisSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { padding: 14, gap: 16, maxWidth: 820, width: '100%', alignSelf: 'center' },
  accountCard: { minHeight: 92, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: '#DDEAE4', padding: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  avatarWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: OASIS.colors.soft },
  avatar: { width: '100%', height: '100%' },
  accountCopy: { flex: 1, alignItems: 'flex-end', minHeight: 50, justifyContent: 'center' },
  accountTitle: { color: OASIS.colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  accountSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  badges: { flexDirection: 'row-reverse', gap: 5, flexWrap: 'wrap', marginTop: 6 },
  group: { gap: 7 },
  groupTitle: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right', paddingHorizontal: 4 },
  groupCard: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  rowIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, alignItems: 'flex-end' },
  rowTitle: { color: OASIS.colors.ink, fontSize: 12.5, fontWeight: '700' },
  rowSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 12 },
  note: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 14 },
  noteText: { flex: 1, color: OASIS.colors.muted, fontSize: 11, lineHeight: 19, fontWeight: '700', textAlign: 'right' },
  logoutWrap: { paddingHorizontal: 4 },
  logoutBtn: { minHeight: 46, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: OASIS.colors.dangerSoft, borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { color: OASIS.colors.danger, fontSize: 12, fontWeight: '800' },
});
