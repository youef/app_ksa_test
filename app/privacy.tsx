import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Activity, Camera, ChevronLeft, Database, LockKeyhole, Mail, ShieldCheck, UserRoundX } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';

type PolicySection = { title: string; paragraphs: string[]; Icon: typeof ShieldCheck };

const SECTIONS: PolicySection[] = [
  {
    title: '1. البيانات التي نعالجها',
    Icon: Database,
    paragraphs: [
      'بيانات الحساب والملف الشخصي: البريد الإلكتروني، الاسم واسم المستخدم، نوع الحساب، معلومات الملف الشخصي، المدينة والحي، وبيانات التواصل التي تختار إضافتها.',
      'المحتوى الذي تنشئه: الإعلانات والمنتجات والخدمات والأسئلة والطلبات والردود والتعليقات والقصص والصور والملفات والرسائل ومحتوى التفاعل والبث المباشر بحسب الميزات التي تستخدمها.',
      'بيانات الموقع: قد نطلب موقع الجهاز عند استخدام الخريطة أو الطقس أو ميزات تحديد الحي. وقد نستخدم موقعًا تقريبيًا في العرض العام بدلًا من إظهار الإحداثيات الدقيقة.',
      'بيانات الجهاز والتشغيل: رمز الإشعارات، منصة الجهاز، معلومات تقنية لازمة لتشغيل التطبيق، وسجلات الأخطاء وبيانات تشخيص الأداء.',
      'بيانات الجلسة والتفاعل: يستخدم التطبيق LogRocket للمساعدة في تشخيص الأعطال وفهم مشكلات الاستخدام. تتضمن إعدادات العميل تصفية للنصوص، كما تُزال رؤوس وأجسام طلبات الشبكة واستجاباتها قبل إرسالها إلى خدمة التشخيص.',
    ],
  },
  {
    title: '2. لماذا نستخدم البيانات؟',
    Icon: Activity,
    paragraphs: [
      'إنشاء الحساب وتسجيل الدخول وإدارة الملف الشخصي والإعدادات.',
      'عرض محتوى المجتمع والسوق والخدمات، وتمكين الرسائل والتواصل وميزات البث.',
      'تحديد الحي وعرض الخرائط والطقس والخدمات المحلية عندما تطلب استخدام هذه الميزات.',
      'إرسال الإشعارات التي تختار تفعيلها، وحماية الحسابات والمستخدمين، ومراجعة البلاغات والمحتوى المخالف.',
      'تشخيص الأخطاء وتحسين استقرار التطبيق وتجربة الاستخدام.',
    ],
  },
  {
    title: '3. أذونات الجهاز',
    Icon: Camera,
    paragraphs: [
      'الصور ومكتبة الوسائط: عند اختيار صورة أو ملف لملفك الشخصي أو إعلانك أو محادثتك أو قصتك.',
      'الكاميرا: عند اختيار التقاط صورة أو استخدام ميزة تتطلب التصوير.',
      'الميكروفون: عند استخدام ميزات الصوت أو البث المباشر التي تحتاج إلى التحدث.',
      'الموقع: عند استخدام ميزة تعتمد على موقعك، مثل الخريطة أو تحديد الحي أو الطقس.',
      'الإشعارات: عند تفعيل إشعارات التطبيق. يمكنك رفض الإذن أو تغييره لاحقًا من إعدادات الجهاز؛ وقد تتوقف الميزة المرتبطة به عند رفضه.',
    ],
  },
  {
    title: '4. مقدمو الخدمات ومشاركة البيانات',
    Icon: Database,
    paragraphs: [
      'Supabase: للمصادقة وقاعدة البيانات وتخزين الملفات والوظائف الخلفية.',
      'Expo وخدمات Apple للإشعارات: لتسجيل رموز الإشعارات وإيصال التنبيهات إلى جهازك.',
      'Google Maps وMapLibre: لتقديم الخرائط وميزات الأماكن والموقع.',
      'LiveKit: لتشغيل ميزات الصوت والفيديو والبث المباشر.',
      'Vercel: لاستضافة صفحات الموقع العامة التي تعرض محتوى وسياسات المنصة.',
      'LogRocket: لتشخيص الأعطال وتحليل تفاعل الجلسات وتحسين الأداء.',
      'نعالج البيانات مع هذه الجهات بالقدر اللازم لتقديم الميزات. وقد تتم المعالجة على خوادم خارج بلد إقامتك وفق بنية مزود الخدمة وشروطه. لا نبيع بياناتك.',
    ],
  },
  {
    title: '5. المحتوى العام والخصوصية',
    Icon: LockKeyhole,
    paragraphs: [
      'قد يظهر الملف الشخصي والإعلانات والمحتوى الذي تنشره للآخرين وفق إعدادات الخصوصية والجمهور الذي تختاره.',
      'يمكنك التحكم في بعض خيارات ظهور الملف الشخصي والتواصل والرسائل من إعدادات الحساب.',
      'لا تنشر معلومات شخصية أو صورًا أو بيانات تخص أشخاصًا آخرين دون إذنهم.',
    ],
  },
  {
    title: '6. الإعلانات والتحليلات والتتبع',
    Icon: Activity,
    paragraphs: [
      'لا يظهر في تكوين التطبيق الحالي تكامل مخصص لشبكات الإعلانات أو لربط نشاطك عبر تطبيقات شركات أخرى لأغراض الإعلانات.',
      'يستخدم التطبيق LogRocket لأغراض التشخيص وتحسين تجربة الاستخدام، وليس لبيع بياناتك أو عرض إعلانات موجهة.',
    ],
  },
  {
    title: '7. الاحتفاظ بالبيانات وحذف الحساب',
    Icon: UserRoundX,
    paragraphs: [
      'نحتفظ بالبيانات ما دامت لازمة لتشغيل الحساب والميزات، وحماية المجتمع، ومعالجة النزاعات، والوفاء بالالتزامات النظامية. وتخضع سجلات التشخيص والنسخ الاحتياطية أيضًا لمدد وسياسات مزودي الخدمة.',
      'يمكنك بدء حذف حسابك من داخل التطبيق عبر الملف الشخصي ثم الإعدادات ثم إدارة الحساب ثم حذف الحساب. يُرسل الطلب إلى خدمة حذف الحساب في المنصة.',
      'قد تبقى سجلات محدودة في النسخ الاحتياطية أو سجلات التشغيل أو لدى مزودي الخدمة للمدة اللازمة لأغراض الاستعادة أو السلامة أو الالتزامات النظامية.',
    ],
  },
  {
    title: '8. الأطفال',
    Icon: ShieldCheck,
    paragraphs: [
      'تحدد شروط المنصة الاستخدام لمن بلغ 18 عامًا أو سن الرشد النظامي، ولا تستهدف المنصة الأطفال.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const bottomInset = useBottomNavInset();
  const { colors } = useTheme();

  const openSupport = async () => {
    try {
      await Linking.openURL('mailto:support@hayna.app?subject=استفسار%20عن%20الخصوصية');
    } catch {
      // The support address remains visible for manual contact if no mail app is configured.
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader variant="sub" title="سياسة الخصوصية" subtitle="بياناتك وخياراتك في منصة حيّنا" fallbackRoute="/safety-center" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]} showsVerticalScrollIndicator={false}>
        <OasisSurface oasisSurface="card" style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.soft }]}>
            <ShieldCheck size={25} color={colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text accessibilityRole="header" style={[styles.heroTitle, { color: colors.ink }]}>سياسة الخصوصية لمنصة حيّنا</Text>
            <Text style={[styles.heroBody, { color: colors.muted }]}>
              آخر تحديث: 24 نوفمبر 2026. توضح هذه السياسة أنواع البيانات التي نعالجها، وأسباب استخدامها، والجهات التي تساعدنا في تشغيل الميزات.
            </Text>
          </View>
        </OasisSurface>

        {SECTIONS.map(({ title, paragraphs, Icon }) => (
          <OasisSurface key={title} oasisSurface="card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.soft }]}>
                <Icon size={17} color={colors.primary} />
              </View>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.ink }]}>{title}</Text>
            </View>
            {paragraphs.map((paragraph, index) => (
              <View key={index} style={styles.paragraphRow}>
                <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                <Text style={[styles.body, { color: colors.ink }]}>{paragraph}</Text>
              </View>
            ))}
          </OasisSurface>
        ))}

        <OasisSurface oasisSurface="card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <Mail size={18} color={colors.primary} />
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.ink }]}>التواصل وطلبات الخصوصية</Text>
          </View>
          <Text style={[styles.body, { color: colors.muted }]}>
            للاستفسارات أو طلبات الخصوصية، تواصل معنا عبر support@hayna.app.
          </Text>
          <Pressable oasisKind="plain" accessibilityRole="link" accessibilityLabel="مراسلة دعم حيّنا بشأن الخصوصية" onPress={openSupport} style={[styles.contactButton, { borderColor: colors.line, backgroundColor: colors.soft }]}>
            <Mail size={16} color={colors.primary} />
            <Text style={[styles.contactText, { color: colors.primary }]}>مراسلة فريق الدعم</Text>
            <ChevronLeft size={16} color={colors.primary} />
          </Pressable>
        </OasisSurface>

        <Text style={[styles.note, { color: colors.muted }]}>
          لا نبيع بياناتك. قد نحدّث هذه السياسة عند إضافة ميزات أو مزودي خدمة جدد، وسننشر النسخة المحدثة عبر هذا المسار.
        </Text>

        <Pressable oasisKind="action" oasisVariant="primary" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={17} color="#FFFFFF" />
          <Text style={styles.backButtonText}>رجوع</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, gap: 12 },
  hero: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13, padding: 17, borderRadius: 20, borderWidth: 1 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, alignItems: 'flex-end', gap: 6 },
  heroTitle: { fontSize: 17, fontWeight: '800', textAlign: 'right' },
  heroBody: { fontSize: 12.5, lineHeight: 21, textAlign: 'right' },
  card: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 11 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '800', textAlign: 'right' },
  paragraphRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7 },
  bullet: { fontSize: 15, lineHeight: 23, fontWeight: '800' },
  body: { flex: 1, fontSize: 12.5, lineHeight: 22, textAlign: 'right' },
  contactButton: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  contactText: { fontSize: 12.5, fontWeight: '800' },
  note: { fontSize: 11.5, lineHeight: 19, textAlign: 'center', paddingHorizontal: 8 },
  backButton: { minHeight: 48, borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  backButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
