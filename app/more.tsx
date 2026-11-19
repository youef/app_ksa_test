import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { usePlatformConfig } from '@/lib/platformConfig';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, ChevronDown, CircleHelp, Info, LifeBuoy, Map,
  MessageCircle, Radio, ShieldCheck, ShoppingBag, Store, UserRound,
  LogOut, FileText, Mail, GraduationCap, Images, Heart, Settings2,
  Search, X, Crown, Plus, Castle, type LucideIcon,
} from 'lucide-react-native';

import { AppHeader } from '@/components/shared/AppHeader';
import { AccountStatusMark } from '@/components/profile/AccountIdentityBadge';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';

type MenuItem = {
  title: string;
  subtitle: string;
  href: string;
  Icon: LucideIcon;
};

const DISCOVER: MenuItem[] = [
  { title: 'سوق الحي', subtitle: 'عروض ومنتجات', href: '/market', Icon: ShoppingBag },
  { title: 'خريطة الحي', subtitle: 'الأماكن حولك', href: '/map', Icon: Map },
  { title: 'توصيل المدارس', subtitle: 'رحلات ومقاعد', href: '/carpooling', Icon: GraduationCap },
  { title: 'الاستفسارات', subtitle: 'أسئلة أهل الحي', href: '/questions', Icon: MessageCircle },
  { title: 'دليل الأعمال', subtitle: 'محلات وخدمات', href: '/directory', Icon: Store },
  { title: 'البث المباشر', subtitle: 'لقاءات المجتمع', href: '/lives', Icon: Radio },
  { title: 'ممالك حيّنا', subtitle: 'ابنِ جزيرتك وحارب خصومًا مجهولين', href: '/kingdom', Icon: Castle },
];

const HELP: MenuItem[] = [
  { title: 'رسائل منصة حيّنا', subtitle: 'الرسائل والإعلانات الرسمية', href: '/platform-inbox', Icon: ShieldCheck },
  { title: 'الدعم والمساعدة', subtitle: 'تواصل مع فريق حيّنا', href: '/support', Icon: LifeBuoy },
  { title: 'الشروط والسياسات', subtitle: 'الخصوصية وإرشادات المجتمع', href: '/terms', Icon: FileText },
  { title: 'حول حيّنا', subtitle: 'تعرف على المنصة', href: '/about', Icon: Info },
];

const ACCOUNT_ACTIONS: MenuItem[] = [
  { title: 'حسابي', subtitle: 'ملفي وبياناتي', href: '/profile', Icon: UserRound },
  { title: 'المفضلة', subtitle: 'المحتوى المحفوظ', href: '/favorites', Icon: Heart },
  { title: 'الإعدادات', subtitle: 'اللغة والمظهر', href: '/settings', Icon: Settings2 },
];

const ADMIN: MenuItem[] = [
  { title: 'لوحة الإدارة', subtitle: 'إدارة المنصة والصلاحيات', href: '/admin', Icon: ShieldCheck },
  { title: 'وكيل حيّنا الذكي', subtitle: 'فحوصات وتحسينات المنصة', href: '/admin-agent', Icon: Settings2 },
  { title: 'الصور والخلفيات', subtitle: 'هوية التطبيق وصور الصفحات', href: '/admin-backgrounds', Icon: Images },
  { title: 'الفلترة والمخالفات', subtitle: 'مراجعة المحتوى والمتابعات', href: '/admin-moderation', Icon: FileText },
  { title: 'مركز التواصل', subtitle: 'الرسائل والتحديثات الرسمية', href: '/admin-broadcast', Icon: Mail },
];

function normalizeSearch(text: string) {
  return text.toLowerCase().normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').trim();
}

function matches(item: MenuItem, query: string) {
  return !query || normalizeSearch(`${item.title} ${item.subtitle}`).includes(query);
}

function openItem(href: string) {
  router.push(href as never);
}

export default function More() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const bottomInset = useBottomNavInset();
  const { flags } = usePlatformConfig();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('');
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [profileError, setProfileError] = useState(false);

  // Refresh the card on return from account editing instead of showing stale identity data.
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setProfileError(false);
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!active) return;
        const id = auth.user?.id ?? '';
        setUserId(id);
        if (!id) { setProfile(null); return; }
        const { data, error } = await supabase.from('profiles')
          .select('id,display_name,username,avatar_url,role,account_type,is_verified,freelance_trade')
          .eq('id', id).maybeSingle();
        if (error) throw error;
        if (active) setProfile(data || null);
      } catch {
        if (active) { setProfile(null); setUserId(''); setProfileError(true); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []));

  const accountName = profile?.account_type === 'merchant' && profile?.freelance_trade
    ? profile.freelance_trade
    : profile?.display_name || profile?.username || 'حسابي';
  const term = normalizeSearch(query);
  const isAdmin = profile?.role === 'admin';

  const discoveryItems = useMemo(() => DISCOVER.filter(item =>
    !((item.href === '/lives' && flags.live === false) ||
      (item.href === '/market' && flags.market === false) ||
      (item.href === '/map' && flags.map === false) ||
      (item.href === '/directory' && flags.directory === false) ||
      (item.href === '/questions' && flags.questions === false) ||
      (item.href === '/carpooling' && flags.carpooling === false))
  ), [flags]);

  const helpItems = HELP.map(item =>
    !userId && item.href === '/support' ? { ...item, href: '/contact-us' } : item
  );
  const shownDiscover = discoveryItems.filter(item => matches(item, term));
  const shownHelp = helpItems.filter(item => matches(item, term));
  const shownAccount = ACCOUNT_ACTIONS.filter(item => matches(item, term));
  const shownAdmin = isAdmin ? ADMIN.filter(item => matches(item, term)) : [];
  const foundAny = shownDiscover.length + shownHelp.length + shownAdmin.length + shownAccount.length > 0;
  const tablet = width >= 720;

  const signOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserId('');
      setProfile(null);
      router.replace('/auth');
    } catch {
      setLogoutError('تعذّر تسجيل الخروج. حاول مرة أخرى.');
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader variant="tab" title="المزيد" subtitle="كل ما تحتاجه في حيّنا" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable oasisKind="plain" accessibilityRole="button"
          accessibilityLabel={profile ? 'فتح حسابي وإعدادات الملف الشخصي' : 'تسجيل الدخول إلى حيّنا'}
          style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
          onPress={() => openItem(profile ? '/profile' : '/auth')}>
          <View style={[styles.avatarWrap, { backgroundColor: colors.soft, borderColor: colors.line }]}>
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <UserRound size={24} color={colors.primary} />}
          </View>
          <View style={styles.accountCopy}>
            {loading ? <View accessibilityLabel="جاري تحميل بيانات الحساب" style={styles.loadingAccount}><ActivityIndicator size="small" color={colors.primary} /><Text style={[styles.accountSub, { color: colors.muted }]}>جاري تحميل الحساب…</Text></View> : (
              <>
                <View style={styles.accountTitleRow}>
                  <Text numberOfLines={1} style={[styles.accountTitle, { color: colors.ink }]}>
                    {profile ? accountName : 'مرحبًا بك في حيّنا'}
                  </Text>
                  {profile && <AccountStatusMark role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} size={16} />}
                </View>
                <Text numberOfLines={1} style={[styles.accountSub, { color: colors.muted }]}>
                  {profileError ? 'تعذر تحديث بيانات الحساب، افتح الصفحة للمحاولة مجددًا' : profile?.username ? `@${profile.username}` : profile ? 'الملف الشخصي والإعدادات' : 'سجّل الدخول للاستفادة من خدمات الحي'}
                </Text>
                {isAdmin && (
                  <View style={styles.adminPill}><Crown size={12} color="#6D28D9"/><Text style={styles.adminPillText}>إدارة حيّنا</Text></View>
                )}
              </>
            )}
          </View>
          <ChevronLeft size={17} color={colors.muted} />
        </Pressable>

        {!term && (
          <View style={styles.quickActions}>
            {ACCOUNT_ACTIONS.map(({ title, href, Icon }) => (
              <Pressable key={href} oasisKind="plain" accessibilityRole="button"
                accessibilityLabel={title} style={[styles.quickAction, { backgroundColor: colors.surface, borderColor: colors.line }]}
                onPress={() => openItem(userId ? href : '/auth')}>
                <Icon size={19} color={colors.primary} />
                <Text style={[styles.quickActionLabel, { color: colors.ink }]}>{title}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Search size={19} color={colors.primary} />
          <TextInput accessibilityLabel="البحث في خدمات حيّنا والإعدادات" returnKeyType="search"
            value={query} onChangeText={setQuery} placeholder="ابحث عن خدمة أو إعداد…"
            placeholderTextColor={colors.muted} selectionColor={colors.primary}
            style={[styles.searchInput, { color: colors.ink }]} />
          {query.length > 0 && (
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="مسح البحث"
              hitSlop={8} style={[styles.searchClear, { backgroundColor: colors.soft }]} onPress={() => setQuery('')}>
              <X size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {term && shownAccount.length > 0 && (
          <MenuGroup title="الحساب والإعدادات" items={shownAccount} signedIn={Boolean(userId)} />
        )}

        {shownDiscover.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>استكشف حيّنا</Text>
              {!term && <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>الخدمات القريبة منك</Text>}
            </View>
            <View style={styles.tileGrid}>
              {shownDiscover.map(({ title, subtitle, href, Icon }) => (
                <Pressable key={href} oasisKind="plain" accessibilityRole="button"
                  accessibilityLabel={`${title}، ${subtitle}`}
                  onPress={() => openItem(href)}
                  style={[styles.tile, { width: tablet ? '31.8%' : '48.4%', backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={[styles.tileIcon, { backgroundColor: colors.soft }]}>
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <View style={styles.tileCopy}>
                    <Text style={[styles.tileTitle, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
                    <Text style={[styles.tileSub, { color: colors.muted }]} numberOfLines={1}>{subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <MenuGroup title="المساعدة والمعلومات" items={shownHelp} signedIn={Boolean(userId)} />

        {isAdmin && shownAdmin.length > 0 && (
          <View style={styles.section}>
            <Pressable oasisKind="plain" accessibilityRole="button"
              accessibilityLabel="أدوات إدارة المنصة"
              accessibilityState={{ expanded: adminExpanded || Boolean(term) }}
              style={[styles.adminToggle, { backgroundColor: colors.surface, borderColor: colors.line }]}
              onPress={() => setAdminExpanded(v => !v)}>
              <View style={[styles.adminToggleIcon, { backgroundColor: colors.soft }]}>
                <ShieldCheck size={19} color={colors.primary}/>
              </View>
              <View style={styles.adminToggleCopy}>
                <Text style={[styles.adminToggleTitle, { color: colors.ink }]}>إدارة المنصة</Text>
                <Text style={[styles.adminToggleSub, { color: colors.muted }]}>الأدوات والصلاحيات الإدارية</Text>
              </View>
              <ChevronDown size={19} color={colors.muted}
                style={(adminExpanded || term) ? { transform: [{ rotate: '180deg' }] } : undefined}/>
            </Pressable>
            {(adminExpanded || Boolean(term)) && (
              <MenuGroup items={shownAdmin} signedIn={Boolean(userId)} compact />
            )}
          </View>
        )}

        {term && !foundAny && (
          <View style={[styles.noResults, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={24} color={colors.muted}/>
            <Text style={[styles.noResultsTitle, { color: colors.ink }]}>ما لقينا خدمة بهذا الاسم</Text>
            <Text style={[styles.noResultsSub, { color: colors.muted }]}>جرّب كلمة أقصر أو استعرض جميع الأقسام.</Text>
            <Pressable oasisKind="plain" accessibilityRole="button" onPress={() => setQuery('')}
              style={[styles.showAllButton, { backgroundColor: colors.soft }]}>
              <Text style={[styles.showAllText, { color: colors.primary }]}>عرض جميع الخدمات</Text>
            </Pressable>
          </View>
        )}

        {userId && (
          <View style={styles.footer}>
            {confirmLogout ? (
              <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text style={[styles.confirmTitle, { color: colors.ink }]}>هل تريد تسجيل الخروج؟</Text>
                <View style={styles.confirmActions}>
                  <Pressable oasisKind="plain" onPress={() => setConfirmLogout(false)}
                    accessibilityRole="button" style={[styles.cancelBtn, { backgroundColor: colors.soft }]}>
                    <Text style={[styles.cancelText, { color: colors.ink }]}>إلغاء</Text>
                  </Pressable>
                  <Pressable oasisKind="plain" disabled={loggingOut} onPress={() => void signOut()}
                    accessibilityRole="button" style={[styles.confirmBtn, { backgroundColor: colors.dangerSoft }]}>
                    {loggingOut ? <ActivityIndicator size="small" color={colors.danger} /> :
                      <Text style={[styles.confirmText, { color: colors.danger }]}>تسجيل الخروج</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable oasisKind="plain" accessibilityRole="button" onPress={() => setConfirmLogout(true)}
                style={styles.logoutBtn}>
                <LogOut size={16} color={colors.danger} />
                <Text style={[styles.logoutText, { color: colors.danger }]}>تسجيل الخروج</Text>
              </Pressable>
            )}
            {!!logoutError && <Text accessibilityRole="alert" style={[styles.logoutError, { color: colors.danger }]}>{logoutError}</Text>}
          </View>
        )}
        <View style={styles.endNote}>
          <CircleHelp size={14} color={colors.muted} />
          <Text style={[styles.endNoteText, { color: colors.muted }]}>حسابك وإعداداتك وخدمات الحي في مكان واحد</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function MenuGroup({ title, items, signedIn, compact = false }: {
  title?: string;
  items: MenuItem[];
  signedIn: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  if (!items.length) return null;
  return (
    <View style={[styles.section, compact && styles.compactSection]}>
      {title ? <Text style={[styles.sectionTitle, { color: colors.ink }]}>{title}</Text> : null}
      <View style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {items.map((item, i) => {
          const Icon = item.Icon;
          return (
            <View key={item.href}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={`${item.title}، ${item.subtitle}`}
                style={styles.menuRow} onPress={() => openItem(!signedIn && ACCOUNT_ACTIONS.some(a => a.href === item.href) ? '/auth' : item.href)}>
                <View style={[styles.menuIcon, { backgroundColor: colors.soft }]}>
                  <Icon size={18} color={colors.primary}/>
                </View>
                <View style={styles.menuCopy}>
                  <Text numberOfLines={1} style={[styles.menuTitle, { color: colors.ink }]}>{item.title}</Text>
                  <Text numberOfLines={1} style={[styles.menuSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
                </View>
                <ChevronLeft size={16} color={colors.muted}/>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 14, paddingTop: 13, gap: 15 },
  accountCard: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 12, gap: 11, borderRadius: 18, borderWidth: 1, minHeight: 84 },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatar: { width: '100%', height: '100%' },
  accountCopy: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-end' },
  loadingAccount: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, minHeight: 38 },
  accountTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, maxWidth: '100%' },
  accountTitle: { fontSize: 15, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  accountSub: { fontSize: 11.5, textAlign: 'right' },
  adminPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 3, marginTop: 2, borderRadius: 9, backgroundColor: '#F3E8FF' },
  adminPillText: { fontSize: 10.5, fontWeight: '700', color: '#6D28D9' },
  quickActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  quickAction: { flex: 1, minHeight: 63, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickActionLabel: { fontSize: 11.5, fontWeight: '700' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 46, gap: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '500', textAlign: 'right', paddingVertical: 8 },
  searchClear: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 9 },
  compactSection: { gap: 0 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { textAlign: 'right', fontSize: 14.5, fontWeight: '700', paddingHorizontal: 2 },
  sectionSubtitle: { fontSize: 11, fontWeight: '500' },
  tileGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9 },
  tile: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 74, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, gap: 8 },
  tileIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 3 },
  tileTitle: { fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  tileSub: { fontSize: 10, fontWeight: '500', textAlign: 'right' },
  groupCard: { borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
  menuRow: { flexDirection: 'row-reverse', minHeight: 62, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 10 },
  menuIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-end' },
  menuTitle: { fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  menuSubtitle: { fontSize: 10.5, fontWeight: '500', textAlign: 'right' },
  divider: { height: 1, marginHorizontal: 12 },
  adminToggle: { minHeight: 64, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 15 },
  adminToggleIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  adminToggleCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  adminToggleTitle: { fontSize: 13, fontWeight: '700' },
  adminToggleSub: { fontSize: 10.5 },
  noResults: { padding: 22, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 9 },
  noResultsTitle: { fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  noResultsSub: { fontSize: 11.5, textAlign: 'center' },
  showAllButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11 },
  showAllText: { fontSize: 12, fontWeight: '700' },
  footer: { paddingTop: 3, alignItems: 'center', gap: 8 },
  logoutBtn: { minHeight: 38, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  logoutText: { fontSize: 11.5, fontWeight: '700' },
  confirmCard: { width: '100%', padding: 12, borderWidth: 1, borderRadius: 14, gap: 11 },
  confirmTitle: { fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  confirmActions: { flexDirection: 'row-reverse', gap: 10 },
  cancelBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  cancelText: { fontSize: 12, fontWeight: '700' },
  confirmBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  confirmText: { fontSize: 12, fontWeight: '700' },
  logoutError: { textAlign: 'center', fontSize: 11.5 },
  endNote: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 6 },
  endNoteText: { fontSize: 10.5, textAlign: 'center' },
});
