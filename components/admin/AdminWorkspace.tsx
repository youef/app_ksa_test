import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { GlassIconArtwork } from '@/components/shared/GlassIconArtwork';
import { HeaderArtwork } from '@/components/shared/HeaderArtwork';
import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowUpRight, ChevronDown, ChevronLeft, Download, LayoutDashboard, Menu, RefreshCw, Search, ShieldCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface WorkspaceGroup<K extends string> {
  key: string;
  label: string;
  tabs: { key: K; label: string; icon: (active: boolean) => React.ReactNode }[];
}

const DESCRIPTIONS: Record<string, string> = {
  overview: 'ملخص المجتمع، أولويات المراجعة وآخر المستجدات في مكان واحد.',
  users: 'ابحث عن أعضاء المجتمع، راجع ملفاتهم وأدر حالة الحساب والصلاحيات.',
  verifications: 'راجع المستندات وطلبات التوثيق واتخذ القرار المناسب لكل طلب.',
  reports: 'تابع البلاغات الواردة وراجع المحتوى والإجراءات السابقة.',
  tasks: 'قائمة موحدة للطلبات والبلاغات والتنبيهات التي تحتاج إلى متابعة.',
  content: 'راجع الأسئلة وطلبات المساعدة وأدر المحتوى المنشور في المجتمع.',
  platform: 'إدارة الخدمات والأدوات المتاحة للإعارة والتنبيهات العاجلة.',
  broadcast: 'جهّز رسالتك وحدد الجمهور ووقت الإرسال.',
  analytics: 'اكتشف اتجاهات النمو والتفاعل وتوزيع نشاط المجتمع.',
  security: 'راجع الجلسات ومحاولات الدخول وإجراءات حماية الحسابات.',
  support: 'تابع استفسارات الأعضاء وتذاكر الدعم حتى معالجتها.',
  logs: 'تتبّع القرارات والتعديلات الإدارية ومن نفّذها.',
  search: 'ابحث في بيانات المجتمع وافتح الملفات وأدر الإجراءات الجماعية.',
  locations: 'أضف المواقع المحلية وراجع بيانات المدن والأحياء.',
  branding: 'حدّث شعار المنصة وراجع الهوية التي تظهر للأعضاء.',
  weekly: 'أنشئ تقارير المتابعة الأسبوعية وراجع التقارير المحفوظة.',
  badges: 'أدر الأوسمة وكرّم الأعضاء المساهمين في المجتمع.',
  config: 'تحكّم في الميزات المتاحة وإعدادات تشغيل المنصة.',
  roles: 'راجع الأدوار والصلاحيات الممنوحة لفريق الإدارة.',
};

interface Props<K extends string> {
  groups: WorkspaceGroup<K>[];
  active: K;
  onNavigate: (key: K) => void;
  badge: (key: K) => number;
  name: string;
  refreshing: boolean;
  updatedAt: Date | null;
  onRefresh: () => void;
  onExport: () => void;
  onExit: () => void;
  updates: number;
  warning?: string;
  toast?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminWorkspace<K extends string>(props: Props<K>) {
  const desktop = useWindowDimensions().width >= 1100;
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const scroll = useRef<ScrollView>(null);
  const group = props.groups.find(g => g.tabs.some(t => t.key === props.active));
  const tab = group?.tabs.find(t => t.key === props.active);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [props.active]);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(open => !open); }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const navigate = (key: K) => { props.onNavigate(key); setMenuOpen(false); setQuery(''); setCommandOpen(false); setCommandQuery(''); };
  const commands = props.groups.flatMap(g => g.tabs.map(t => ({ ...t, group: g.label }))).filter(t => `${t.label} ${t.group}`.includes(commandQuery.trim()));
  const navigation = (
    <View style={[s.sidebar, !desktop && s.mobileSidebar, desktop && { paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(14, insets.bottom) }]}>
      {desktop ? <View style={s.brand}><View style={s.brandIcon}><ShieldCheck size={25} color="#BDE7D6" /></View><View><Text style={s.brandName}>حيّنا</Text><Text style={s.brandSub}>مساحة الإدارة</Text></View></View> : null}
      <View style={s.navSearch}><Search size={16} color="#94AFA5" /><TextInput accessibilityLabel="البحث في أقسام الإدارة" placeholder="ابحث عن قسم…" placeholderTextColor="#94AFA5" value={query} onChangeText={setQuery} style={s.navInput} /></View>
      <ScrollView showsVerticalScrollIndicator={false} style={s.navScroll} keyboardShouldPersistTaps="handled">
        {props.groups.map(g => {
          const tabs = g.tabs.filter(t => `${t.label} ${g.label}`.includes(query.trim()));
          return tabs.length ? <View key={g.key} style={s.group}>
            <Text style={s.groupTitle}>{g.label}</Text>
            {tabs.map(t => <Pressable key={t.key} accessibilityRole="button" accessibilityState={{ selected: t.key === props.active }} onPress={() => navigate(t.key)} style={({ pressed }) => [s.navItem, t.key === props.active && s.navActive, pressed && s.pressed]}>
              <View style={s.navIcon}>{t.icon(t.key === props.active)}</View><Text style={[s.navLabel, t.key === props.active && s.navLabelActive]}>{t.label}</Text>
              {props.badge(t.key) > 0 ? <Text style={s.navBadge}>{props.badge(t.key).toLocaleString('ar-SA')}</Text> : null}
            </Pressable>)}
          </View> : null;
        })}
        {!props.groups.some(g => g.tabs.some(t => `${t.label} ${g.label}`.includes(query.trim()))) ? <Text style={s.navEmpty}>لا يوجد قسم مطابق</Text> : null}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={props.onExit} style={s.exit}><ArrowUpRight size={17} color="#BDE7D6" /><Text style={s.exitText}>العودة إلى المجتمع</Text></Pressable>
      <View style={s.adminIdentity}><View style={s.avatar}><Text style={s.avatarText}>{props.name.trim().slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={s.identityName}>{props.name}</Text><Text style={s.brandSub}>مدير المنصة</Text></View><ShieldCheck size={16} color="#94AFA5" /></View>
    </View>
  );
  return <View style={s.root}>
    {desktop ? navigation : null}
    <View style={s.main}>
      <View style={[s.toolbar, { paddingTop: insets.top, minHeight: 48 + insets.top, overflow: 'hidden' }]}><HeaderArtwork />
        <View style={s.breadcrumb}><LayoutDashboard size={17} color="#71847B" /><Text style={s.breadcrumbText}>{desktop ? 'الإدارة' : 'حيّنا'}</Text>{desktop ? <><ChevronLeft size={13} color="#A2AEA7" /><Text style={s.breadcrumbCurrent}>{group?.label}</Text></> : null}</View>
        <View style={s.toolbarActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="فتح البحث السريع في الإدارة" onPress={() => { setCommandQuery(''); setCommandOpen(true); }} style={[s.commandTrigger, { backgroundColor: 'transparent', borderWidth: 0 }]}><GlassIconArtwork /><View style={{ position: 'relative', zIndex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Search size={17} color="#476457" />{desktop ? <><Text style={s.commandTriggerText}>انتقل إلى قسم…</Text><Text style={s.keycap}>⌘ / Ctrl K</Text></> : null}</View></Pressable>
          {!desktop ? <Pressable oasisKind="icon" accessibilityRole="button" accessibilityLabel={menuOpen ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'} onPress={() => setMenuOpen(v => !v)} style={[s.iconButton, { borderWidth: 0 }]}><GlassIconArtwork /><View style={{ position: 'relative', zIndex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{menuOpen ? <X size={20} color="#173E31" /> : <Menu size={20} color="#173E31" />}</View></Pressable> : null}
          <Pressable oasisKind="icon" disabled={props.refreshing} accessibilityRole="button" accessibilityLabel="تحديث بيانات الإدارة" onPress={props.onRefresh} style={[s.iconButton, { borderWidth: 0 }]}><GlassIconArtwork /><View style={{ position: 'relative', zIndex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{props.refreshing ? <ActivityIndicator size="small" color="#18664C" /> : <RefreshCw size={18} color="#476457" />}</View></Pressable>
          <Pressable oasisKind="action" accessibilityRole="button" onPress={props.onExport} style={[s.exportButton, { backgroundColor: 'transparent', borderWidth: 0 }]}><GlassIconArtwork /><View style={{ position: 'relative', zIndex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Download size={16} color="#274D3C" /><Text style={s.exportText}>تصدير</Text></View></Pressable>
        </View>
      </View>
      {props.toast}
      {menuOpen && !desktop ? navigation : <ScrollView ref={scroll} style={s.body} contentContainerStyle={[s.bodyContent, { paddingBottom: Math.max(20, insets.bottom) }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor="#38765A" />}>
        <View style={s.pageHeader}>
          <View style={s.headingBlock}><Text style={s.eyebrow}>إدارة المجتمع / {group?.label}</Text><Text accessibilityRole="header" style={s.title}>{tab?.label || 'لوحة الإدارة'}</Text><Text style={s.description}>{DESCRIPTIONS[props.active] || 'أدوات وإعدادات منظمة لإدارة هذا القسم ومتابعة تفاصيله.'}</Text></View>
          <View style={s.sync}><View style={s.syncDot} /><Text style={s.syncText}>{props.updatedAt ? `آخر تحديث ${props.updatedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : 'بانتظار تحديث البيانات'}</Text></View>
        </View>
        {!desktop ? <Pressable accessibilityRole="button" onPress={() => setMenuOpen(true)} style={s.sectionPicker}><View style={s.breadcrumb}>{tab?.icon(true)}<Text style={s.breadcrumbCurrent}>{tab?.label}</Text></View><ChevronDown size={17} color="#587266" /></Pressable> : null}
        {props.warning ? <View accessibilityRole="alert" style={[s.updateBanner, { backgroundColor: '#FBF1DF' }]}><Text style={[s.updateText, { color: '#8B712D' }]}>{props.warning}</Text><Pressable accessibilityRole="button" disabled={props.refreshing} onPress={props.onRefresh}><Text style={s.exportText}>إعادة المحاولة</Text></Pressable></View> : null}
        {props.updates > 0 ? <Pressable accessibilityRole="button" onPress={props.onRefresh} style={s.updateBanner}><RefreshCw size={16} color="#18664C" /><Text style={s.updateText}>{props.updates} تحديث جديد — اضغط لجلب أحدث البيانات</Text></Pressable> : null}
        {props.children}
        <View style={s.footer}><Text style={s.footerText}>حيّنا · إدارة المجتمع</Text><Text style={s.footerText}>قرارات أوضح، مجتمع أقرب</Text></View>
      </ScrollView>}
    </View>
    <Modal visible={commandOpen} transparent animationType="fade" onRequestClose={() => setCommandOpen(false)}>
      <View style={s.commandOverlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="إغلاق البحث السريع" style={StyleSheet.absoluteFillObject} onPress={() => setCommandOpen(false)} />
        <View accessibilityViewIsModal style={s.commandPanel}>
          <View style={s.commandHeading}><View><Text style={s.commandTitle}>إلى أين تريد الانتقال؟</Text><Text style={s.commandSubtitle}>كل أدوات الإدارة، على بُعد بحث واحد.</Text></View><Pressable oasisKind="icon" accessibilityRole="button" accessibilityLabel="إغلاق نافذة البحث" onPress={() => setCommandOpen(false)} style={[s.iconButton, { borderWidth: 0 }]}><GlassIconArtwork /><View style={{ position: 'relative', zIndex: 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}><X size={18} color="#476457" /></View></Pressable></View>
          <View style={s.commandSearch}><Search size={20} color="#5B8B72" /><TextInput autoFocus value={commandQuery} onChangeText={setCommandQuery} accessibilityLabel="ابحث عن أداة أو قسم" placeholder="ابحث عن أداة أو قسم…" placeholderTextColor="#91A399" style={s.commandInput} onSubmitEditing={() => { if (commands[0]) navigate(commands[0].key); }} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" style={s.commandResults}>{commands.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={() => navigate(item.key)} style={({ pressed }) => [s.commandResult, pressed && s.commandResultPressed]}><View style={s.commandResultIcon}>{item.icon(item.key === props.active)}</View><View style={{ flex: 1 }}><Text style={s.commandResultTitle}>{item.label}</Text><Text style={s.commandSubtitle}>{item.group}</Text></View>{props.badge(item.key) > 0 ? <Text style={s.commandCount}>{props.badge(item.key)}</Text> : null}<ArrowUpRight size={16} color="#7D9E8A" /></Pressable>)}{!commands.length ? <Text style={s.commandEmpty}>لا توجد نتائج. جرّب اسم قسم آخر.</Text> : null}</ScrollView>
          <View style={s.commandFooter}><Text style={s.commandSubtitle}>{commands.length} قسم متاح</Text><Text style={s.commandSubtitle}>Enter لفتح أول نتيجة · Esc للإغلاق</Text></View>
        </View>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  commandTrigger: { minHeight: 38, minWidth: 38, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#F2F6F3', borderWidth: 1, borderColor: '#E0E9E3' }, commandTriggerText: { color: '#83968B', fontSize: 11 }, keycap: { fontSize: 11, color: '#8DA094', backgroundColor: OASIS.colors.surface, padding: 4, borderRadius: 5 },
  commandOverlay: { flex: 1, backgroundColor: 'rgba(8,30,24,0.62)', alignItems: 'center', justifyContent: 'center', padding: 18 }, commandPanel: { width: '100%', maxWidth: 590, maxHeight: '85%', backgroundColor: '#FAFCF9', borderRadius: 14, borderWidth: 1, borderColor: '#DDE9DD', overflow: 'hidden' }, commandHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 10 }, commandTitle: { color: '#234C39', fontSize: 19, fontWeight: '600', textAlign: 'right' }, commandSubtitle: { color: '#7D9384', fontSize: 11, textAlign: 'right', marginTop: 5 }, commandSearch: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#CEE1D2', backgroundColor: OASIS.colors.surface, borderRadius: 12, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14 }, commandInput: { flex: 1, minHeight: 44, fontSize: 14, color: '#234C39', textAlign: 'right' }, commandResults: { maxHeight: 380, paddingHorizontal: 12 }, commandResult: { flexDirection: 'row-reverse', alignItems: 'center', padding: 12, gap: 12, borderRadius: 12, marginBottom: 4 }, commandResultPressed: { backgroundColor: '#E9F2E8' }, commandResultIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EAF1E9', alignItems: 'center', justifyContent: 'center' }, commandResultTitle: { color: '#2C513C', fontSize: 13, fontWeight: '700', textAlign: 'right' }, commandCount: { color: '#3B7352', backgroundColor: '#E4EFE1', borderRadius: 7, padding: 6, fontSize: 11 }, commandEmpty: { padding: 16, color: '#7D9384', textAlign: 'center' }, commandFooter: { borderTopWidth: 1, borderColor: '#E1E9DF', padding: 15, flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  root: { flex: 1, flexDirection: 'row-reverse', backgroundColor: '#F2F6F3' },
  sidebar: { width: 260, backgroundColor: '#102E2B', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  mobileSidebar: { width: '100%', flex: 1, paddingTop: 16 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingBottom: 16, paddingHorizontal: 8 },
  brandIcon: { width: 46, height: 46, backgroundColor: '#24483A', borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 20, fontWeight: '700', color: OASIS.colors.surface, textAlign: 'right' },
  brandSub: { color: '#9DB6AA', fontSize: 11, marginTop: 3, textAlign: 'right' },
  navSearch: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#355146', borderRadius: 10, paddingHorizontal: 10, marginBottom: 14 },
  navInput: { flex: 1, minHeight: 42, textAlign: 'right', color: OASIS.colors.surface, fontSize: 12 },
  navScroll: { flex: 1 }, group: { marginBottom: 16 }, groupTitle: { color: '#8CA89B', textAlign: 'right', fontSize: 11, fontWeight: '700', marginBottom: 8, paddingHorizontal: 10 },
  navItem: { minHeight: 41, borderRadius: 9, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 10, marginBottom: 3 },
  navActive: { backgroundColor: '#D1EEA5', borderRightWidth: 3, borderRightColor: '#A2D36A' }, navIcon: { backgroundColor: '#F1F5F1', borderRadius: 6, width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  navLabel: { color: '#D4E1DA', fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' }, navLabelActive: { color: '#173E31', fontWeight: '600' },
  navBadge: { backgroundColor: '#BFD7C9', color: '#173E31', borderRadius: 6, fontSize: 11, paddingHorizontal: 6, paddingVertical: 3, fontWeight: '600' }, navEmpty: { color: '#BFD7C9', padding: 16, textAlign: 'center' },
  exit: { flexDirection: 'row-reverse', gap: 8, padding: 12, alignItems: 'center' }, exitText: { color: '#BDE7D6', fontSize: 12 },
  adminIdentity: { borderTopWidth: 1, borderColor: '#355146', paddingTop: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#355647', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#E2F1E7', fontWeight: '600' }, identityName: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  main: { flex: 1, minWidth: 0 }, toolbar: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: OASIS.colors.surface, borderBottomWidth: 1, borderColor: '#E3E9E2', gap: 8 },
  breadcrumb: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, breadcrumbText: { color: '#71847B', fontSize: 12 }, breadcrumbCurrent: { color: '#254737', fontWeight: '700', fontSize: 12 },
  toolbarActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, iconButton: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: '#E3E9E2', alignItems: 'center', justifyContent: 'center' },
  exportButton: { minHeight: 38, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: '#D3DFD4', paddingHorizontal: 12 }, exportText: { color: '#274D3C', fontSize: 12, fontWeight: '700' },
  body: { flex: 1 }, bodyContent: { padding: 16, width: '100%', maxWidth: 1500, alignSelf: 'center' }, pageHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }, headingBlock: { flexGrow: 1, flexBasis: 250 },
  eyebrow: { color: '#75877D', fontSize: 11, textAlign: 'right', marginBottom: 6 }, title: { color: '#163A2A', fontSize: 22, fontWeight: '700', textAlign: 'right' }, description: { color: '#748075', fontSize: 12, lineHeight: 21, textAlign: 'right', marginTop: 7 },
  sync: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }, syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#679E76' }, syncText: { color: '#748075', fontSize: 11 },
  sectionPicker: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: '#DCE5DB', borderRadius: 12, padding: 15, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  updateBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: '#E3F1E6', marginBottom: 16 }, updateText: { flex: 1, color: '#18664C', fontSize: 12, textAlign: 'right' },
  footer: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderColor: '#DDE5DB', paddingVertical: 14, marginTop: 16 }, footerText: { color: '#89948A', fontSize: 11 }, pressed: { opacity: 0.7 },
});
