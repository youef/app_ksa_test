import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { ShieldCheck, Phone, AlertTriangle, FileText, Mail, ChevronLeft, LockKeyhole, Eye, UserRoundCheck, LifeBuoy, Siren, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';


export default function SafetyCenterScreen() {
  const bottomNavInset = useBottomNavInset();
  const [expanded, setExpanded] = useState<number | null>(0);

  const open = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert('تعذّر الفتح', 'لم نتمكن من فتح هذا الخيار على جهازك.'); }
  };

  const items = [
    { icon: <Eye size={19} color={OASIS.colors.primary} />, title: 'تحكّم بخصوصيتك', desc: 'راجع من يمكنه التواصل معك وما يظهر في ملفك الشخصي.', action: 'إعدادات الخصوصية', onPress: () => router.push({ pathname: '/profile', params: { tab: 'settings' } }) },
    { icon: <UserRoundCheck size={19} color={OASIS.colors.info} />, title: 'تعزيز موثوقية حسابك', desc: 'أكمل بيانات ملفك واطلب توثيق حسابك عند الحاجة.', action: 'نوع الحساب والتوثيق', onPress: () => router.push({ pathname: '/profile', params: { tab: 'profile', section: 'identity' } }) },
    { icon: <LifeBuoy size={19} color={OASIS.colors.gold} />, title: 'تحتاج إلى مساعدة؟', desc: 'افتح تذكرة خاصة وتابع الردود من فريق حيّنا.', action: 'مركز الدعم', onPress: () => router.push('/support') },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="مركز الأمان والثقة" subtitle="مساحة آمنة لمجتمع حيّنا" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 32 }]}>
        <LinearGradient colors={['#063B31', '#087F5B', '#0D9488']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><ShieldCheck size={27} color={OASIS.colors.soft} /></View>
            <View style={styles.livePill}><CheckCircle2 size={12} color="#BBF7D0" /><Text style={styles.livePillText}>السلامة أولويتنا</Text></View>
          </View>
          <Text style={styles.heroTitle}>مجتمع أكثر أمانًا، يبدأ منك</Text>
          <Text style={styles.heroDesc}>أبلغ عن السلوك المقلق، احمِ معلوماتك الشخصية، وتواصل مع فريق الدعم عند الحاجة.</Text>
          <Pressable oasisKind="action" accessibilityRole="button" accessibilityLabel="إرسال بلاغ جديد" onPress={() => router.push('/report')} style={styles.heroButton}>
            <AlertTriangle size={17} color={OASIS.colors.deep} />
            <Text style={styles.heroButtonText}>إرسال بلاغ جديد</Text>
            <ChevronLeft size={16} color={OASIS.colors.deep} />
          </Pressable>
        </LinearGradient>

        <View style={styles.quickGrid}>
          <Pressable oasisKind="card" accessibilityRole="button" accessibilityLabel="الإبلاغ عن إساءة: محتوى أو حساب أو سلوك" style={styles.quickCard} onPress={() => router.push('/report')}>
            <View style={[styles.quickIcon,{backgroundColor:OASIS.colors.dangerSoft}]}><AlertTriangle size={21} color={OASIS.colors.danger} /></View>
            <Text style={styles.quickTitle}>الإبلاغ عن إساءة</Text>
            <Text style={styles.quickDesc}>محتوى أو حساب أو سلوك</Text>
          </Pressable>
          <Pressable oasisKind="card" accessibilityRole="button" accessibilityLabel="متابعة البلاغات: تواصل مع فريق الدعم" style={styles.quickCard} onPress={() => router.push('/support')}>
            <View style={[styles.quickIcon,{backgroundColor:OASIS.colors.infoSoft}]}><FileText size={21} color={OASIS.colors.info} /></View>
            <Text style={styles.quickTitle}>متابعة البلاغات</Text>
            <Text style={styles.quickDesc}>تواصل مع فريق الدعم</Text>
          </Pressable>
        </View>

        <SectionHeading title="أدوات الأمان" subtitle="إعدادات وخيارات تساعدك على البقاء مطمئنًا" />
        {items.map((item, index) => (
          <Pressable oasisKind="card" key={item.title} accessibilityRole="button" accessibilityLabel={item.title + '. ' + item.desc} accessibilityState={{ expanded: expanded === index }} onPress={() => setExpanded(expanded === index ? null : index)} style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
              <ChevronLeft size={17} color={OASIS.colors.muted} />
            </View>
            {expanded === index && <Pressable accessibilityRole="button" accessibilityLabel={item.action} onPress={item.onPress} style={styles.inlineAction}><Text style={styles.inlineActionText}>{item.action}</Text><ChevronLeft size={14} color={OASIS.colors.primary}/></Pressable>}
          </Pressable>
        ))}

        <OasisSurface oasisSurface="card" style={styles.emergencyCard}>
          <View style={styles.emergencyHeading}>
            <View style={styles.emergencyIcon}><Siren size={21} color={OASIS.colors.danger} /></View>
            <View style={{flex:1,gap:3}}>
              <Text style={styles.emergencyTitle}>حالة طارئة؟</Text>
              <Text style={styles.emergencyDesc}>إذا كان هناك خطر فوري على الحياة أو السلامة، تواصل مع خدمات الطوارئ الرسمية في منطقتك.</Text>
            </View>
          </View>
          <Pressable oasisKind="action" accessibilityRole="button" accessibilityLabel="اتصال مباشر بالطوارئ على الرقم 911" onPress={() => open('tel:911')} style={styles.emergencyButton}><Phone size={16} color={OASIS.colors.surface}/><Text style={styles.emergencyButtonText}>الاتصال بالطوارئ · 911</Text></Pressable>
          <View style={styles.disclaimerSurface}><Text style={styles.disclaimer}>لا تستخدم البلاغ داخل التطبيق بدلًا من الاتصال بالطوارئ عند وجود خطر فوري. الرقم الظاهر 911 قد لا يكون مناسبًا لكل منطقة؛ تأكد من رقم الطوارئ الرسمي في موقعك.</Text></View>
        </OasisSurface>

        <Pressable accessibilityRole="button" accessibilityLabel="سياسة الخصوصية وشروط الاستخدام" onPress={() => open('https://appksatest.vercel.app/privacy')} style={styles.policyRow}>
          <View style={styles.policyIcon}><LockKeyhole size={18} color={OASIS.colors.muted}/></View>
          <View style={{flex:1,gap:3}}><Text style={styles.policyTitle}>سياسة الخصوصية وشروط الاستخدام</Text><Text style={styles.policyDesc}>اعرف كيف نساعد في حماية بياناتك وحقوقك.</Text></View>
          <ChevronLeft size={17} color="#94A3B8"/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="التواصل مع فريق الثقة والأمان عبر البريد" onPress={() => open('mailto:support@hayna.app?subject=الأمان%20والثقة%20-%20حيّنا')} style={styles.contactRow}>
          <Mail size={17} color={GREEN}/><Text style={styles.contactText}>التواصل مع فريق الثقة والأمان</Text><ChevronLeft size={15} color={GREEN}/>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeading({title,subtitle}:{title:string;subtitle:string}) {
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 15 },
  hero: { borderRadius: 22, padding: 21, gap: 14, overflow: 'hidden' },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)', minHeight: 36 },
  livePillText: { fontSize: 11.5, fontWeight: '700', color: '#D1FAE5' },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'right', lineHeight: 30 },
  heroDesc: { fontSize: 13.5, lineHeight: 22, color: '#D1FAE5', textAlign: 'right' },
  heroButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: OASIS.colors.soft, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, marginTop: 4 },
  heroButtonText: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.deep },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: { flex: 1, minWidth: 0, minHeight: 136, backgroundColor: OASIS.colors.surface, borderRadius: 20, borderWidth: 1, borderColor: OASIS.colors.line, padding: 15, gap: 8 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  quickDesc: { fontSize: 12, color: OASIS.colors.muted, textAlign: 'right', lineHeight: 18 },
  sectionHeading: { gap: 5, marginTop: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', lineHeight: 23 },
  sectionSubtitle: { fontSize: 12.5, color: OASIS.colors.muted, textAlign: 'right', lineHeight: 19 },
  infoCard: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 20, padding: 15, gap: 12 },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 56 },
  infoIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: OASIS.colors.background, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, gap: 5 },
  infoTitle: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  infoDesc: { fontSize: 12, color: OASIS.colors.muted, lineHeight: 19, textAlign: 'right' },
  inlineAction: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: OASIS.colors.soft, borderRadius: 12 },
  inlineActionText: { fontSize: 12, fontWeight: '700', color: OASIS.colors.primary },
  emergencyCard: { backgroundColor: OASIS.colors.dangerSoft, borderColor: OASIS.colors.line, borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  emergencyHeading: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  emergencyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  emergencyTitle: { fontSize: 15, fontWeight: '700', color: OASIS.colors.danger, textAlign: 'right' },
  emergencyDesc: { fontSize: 12.5, color: OASIS.colors.ink, textAlign: 'right', lineHeight: 20 },
  emergencyButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: OASIS.colors.danger, paddingHorizontal: 16, paddingVertical: 12, minHeight: 50, borderRadius: 15 },
  emergencyButtonText: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 13 },
  disclaimerSurface: { backgroundColor: OASIS.colors.warningSoft, borderRadius: 12, padding: 12 },
  disclaimer: { fontSize: 12, color: OASIS.colors.ink, lineHeight: 20, textAlign: 'right' },
  policyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 82, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 18, padding: 15 },
  policyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: OASIS.colors.background, alignItems: 'center', justifyContent: 'center' },
  policyTitle: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', lineHeight: 19 },
  policyDesc: { fontSize: 12, color: OASIS.colors.muted, textAlign: 'right', lineHeight: 18 },
  contactRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: OASIS.colors.soft, borderRadius: 14 },
  contactText: { fontSize: 12.5, fontWeight: '700', color: OASIS.colors.primary },
});
