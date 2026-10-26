import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';
import { ShieldCheck, AlertTriangle, Scale, Lock, Eye, MessageCircle, UserX, Gavel, FileText, ChevronLeft } from 'lucide-react-native';

type Clause = { title: string; body: string | string[] };

const CLAUSES: Clause[] = [
  {
    title: '1. قبول الشروط',
    body: [
      'باستخدامك منصة حيّنا (الموقع/التطبيق) فإنك توافق على هذه الشروط والسياسات («الشروط») بالكامل. إذا لم توافق على أي بند، فتوقف عن استخدام المنصة فورًا.',
      'نحتفظ بحق تعديل الشروط في أي وقت، ويعتبر استمرارك في الاستخدام بعد التعديل قبولاً للنسخة المحدثة.',
    ],
  },
  {
    title: '2. تعريف المنصة',
    body: [
      'حيّنا منصة مجتمعية محلية («المنصة») تتيح لأعضاء الحي التفاعل، ونشر الإعلانات والخدمات، والتجارة، وطلب المساعدة، والتواصل.',
      'المنصة وسيط تقني (Marketplace/Community Platform) وليست طرفًا في أي صفقة أو اتفاق بين المستخدمين.',
    ],
  },
  {
    title: '3. الأهلية',
    body: [
      'يجب أن تكون قد بلغت 18 عامًا (أو سن الرشد في نظامك) لتستخدم المنصة.',
      'يجب أن تكون معلوماتك (الاسم، الموقع، بيانات التواصل) صحيحة وقابلة للتحقق.',
      'حساب واحد لكل شخص. إنشاء حسابات وهمية أو متعددة (Multi-accounting) ممنوع.',
    ],
  },
  {
    title: '4. حساب المستخدم',
    body: [
      'أنت مسؤول عن سرية كلمة المرور وجميع الأنشطة على حسابك.',
      'يجب تحديث معلوماتك عند تغييرها. إخفاء هوية (للتعارف/المغازل) ممنوع (انظر بند 6).',
      'المنصة قد تطلب توثيق الهوية/الصفة (فردي، تجاري، عمل حر، مقدم خدمة) before granting capabilities. التوثيق منفصل عن التسجيل ولا يمنح صلاحيات until approved by administration.',
    ],
  },
  {
    title: '5. قواعد السلوك (صارمة)',
    body: [
      'يُمنع منعًا باتًا: التعارف (Dating)، المغازل (Flirting)، التلميحات الجنسية، طلب علاقة، أو أي سلوك رومانسي/جنسي.',
      'يُمنع التحرش (Harassment)، التهديد، الإهانة، التنمر، التمييز (عرقي/ديني/جنساني)، خطاب الكراهية.',
      'يُمنع نشر/مشاركة أي محتوى جنسي (صور، فيديو، نص، إيموجي) أو إيحائي (Sexual innuendo) أو فاضح.',
      'يُمنع انتحال الشخصية (Impersonation) أو نشر معلومات كاذبة/مضللة (Misinformation).',
      'يُمنع الاحتيال (Scam)، طلب أموال/بطاقات، phishing، أو استغلال ثقة الأعضاء.',
      'يُمنع نشر معلومات شخصية للآخرين (Doxxing) أو معلومات مالية/طبية حساسة.',
      'يُمنع Spam والرسائل الجماعية غير المرغوب فيها والإعلانات خارج القنوات المخصصة.',
      'يُمنع استخدام المنصة لأي نشاط غير قانوني (ممنوعات، أسلحة، مخدرات، قمار، إرهاب).',
      'يُمنع استغلال ثغرات أو محاولة اختراق/DDoS/Scraping.',
    ],
  },
  {
    title: '6. المحتوى',
    body: [
      'أنت مسؤول عن كل ما تنشره (نص، صورة، فيديو، صوت، رابط).',
      'ممنوع: محتوى جنسي/إيحائي، عنف، كراهية، احتيال، معلومات كاذبة، محتوى ينتهك خصوصية الآخرين.',
      'المنصة قد تحذف أي محتوى مخالف دون إشعار مسبق.',
      'الإعلانات (السوق/الخدمات) يجب أن تكون حقيقية، مع سعر واضح، وصور حقيقية للمنتج/الخدمة. الإعلان المضلل = حظر.',
    ],
  },
  {
    title: '7. الخصوصية وحماية البيانات',
    body: [
      'نجمع بيانات ضرورية (الحساب، الموقع، نشاط) لتشغيل المنصة. انظر سياسة الخصوصية.',
      'لا نبيع بياناتك. نشاركها فقط مع مقدمي خدمات (Supabase، Push) لتشغيل المنصة.',
      'أنت تتحكم في ظهورك (حساب خاص، إخفاء الاسم، إعدادات DM).',
      'ممنوع مشاركة بيانات الآخرين (Doxxing).',
    ],
  },
  {
    title: '8. الإبلاغ (Reporting)',
    body: [
      'أي مستخدم يمكنه الإبلاغ عن حساب/محتوى/رسالة عبر زر «إبلاغ».',
      'الإبلاغات تُراجع من فريق حيّنا (و/أو المشرفين).',
      'الإبلاغ الكاذب/المسيء (False reporting) قد يؤدي إلى إجراءات ضد المُبلِغ.',
      'في حالات الطوارئ (تهديد، اعتداء، خطر) اتصل بالجهات المختصة (999/911/997) فورًا. المنصة ليست بديلًا عن الطوارئ.',
    ],
  },
  {
    title: '9. الإجراءات (Enforcement)',
    body: [
      'مخالفات بسيطة: تحذير (Warning) + حذف المحتوى.',
      'مخالفات متوسطة: تقييد (Restriction) (مثلاً إيقاف DM/نشر) + حذف.',
      'مخالفات جسيمة (تحرش، جنسي، احتيال، تهديد، غير قانوني): حظر فوري (Ban) + حذف جميع البيانات + تزويد الجهة القانونية.',
      'الجهة القانونية: في حالة حدث مشكلة (تحرش، تهديد، احتيال، اعتداء، أو أي جريمة) سنتعاون مع Authorities (شرطة/نيابة/هيئة) ونزودهم بالمعلومات (هوية، IP، رسائل، سجلات) حسب النظام (PDPL/الأنظمة السعودية).',
      'لا استئناف (Appeal) لبعض الإجراءات (خاصة cases of safety/legal).',
    ],
  },
  {
    title: '10. المسؤولية (Disclaimer)',
    body: [
      'المنصة «كما هي» (AS IS) بدون ضمانات.',
      'نحن غير مسؤولين عن interactions/صفقات بين المستخدمين. تحقق بنفسك قبل أي صفقة.',
      'نحن غير مسؤولين عن خسائر (مباشرة/غير مباشرة) ناتجة عن استخدام المنصة.',
      'أنت تتحمل المسؤولية (Civil/Criminal) عن مخالفاتك.',
    ],
  },
  {
    title: '11. الملكية (IP)',
    body: [
      'المحتوى الذي تنشره يبقى ملكك، ولكنك تمنح المنصة ترخيصًا (License) غير حصري لعرضه/تخزينه/معالجته (لتشغيل المنصة).',
      'اسم/شعار حيّنا وتصميمها ملك للمنصة. ممنوع نسخ/استخدام دون إذن.',
    ],
  },
  {
    title: '12. التعديلات',
    body: [
      'قد نعدل الشروط. سنخطرك (إشعار/بريد) عند تغييرات جوهرية.',
      'استمرار الاستخدام = قبول.',
    ],
  },
  {
    title: '13. القانون والاختصاص',
    body: [
      'تخضع الشروط لأنظمة المملكة العربية السعودية (بما فيها PDPL، نظام مكافحة جرائم المعلوماتية، نظام الحماية من الإساءة).',
      'أي نزاع → محاكم المملكة (الرياض/عرعر حسب الاختصاص).',
    ],
  },
  {
    title: '14. التواصل',
    body: [
      'للاستفسارات/الإبلاغات: support@hayna.app أو «الدعم والمساعدة» في التطبيق.',
      'للطوارئ: 999 (شرطة) / 911 (إسعاف) / 997 (مرور) / 933 (حماية).',
    ],
  },
];

export default function TermsScreen() {
  const bottomInset = useBottomNavInset();
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
      <AppHeader variant="sub" title="الشروط والسياسات" subtitle="جميع بنود منصة حيّنا" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]} showsVerticalScrollIndicator={false}>
        <OasisSurface oasisSurface="card" style={[styles.hero, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.heroIcon}><ShieldCheck size={26} color={OASIS.colors.primary} /></View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, isDark && { color: colors.ink }]}>شروط وسياسات منصة حيّنا</Text>
            <Text style={[styles.heroSub, isDark && { color: colors.muted }]}>
              بنود صارمة لحماية المجتمع. التعارف/المغازل والتحرش/المحتوى الجنسي محظور. المخالفات تُحاسب، والمشكلات تُحال للجهة القانونية.
            </Text>
          </View>
        </OasisSurface>

        {CLAUSES.map((clause) => (
          <OasisSurface key={clause.title} oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.cardHeader}>
              <Scale size={16} color={OASIS.colors.primary} />
              <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>{clause.title}</Text>
            </View>
            {Array.isArray(clause.body) ? clause.body.map((p, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.body, isDark && { color: colors.ink }]}>{p}</Text>
              </View>
            )) : (
              <Text style={[styles.body, isDark && { color: colors.ink }]}>{clause.body}</Text>
            )}
          </OasisSurface>
        ))}

        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <AlertTriangle size={16} color={OASIS.colors.danger} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>تنبيه</Text>
          </View>
          <Text style={[styles.body, isDark && { color: colors.ink }]}>
            هذه الشروط إرشادية وقد تُحدّث. في حالات الطوارئ (تهديد/اعتداء/خطر) اتصل فورًا بالجهات المختصة (999/911/997/933). المنصة ليست بديلًا عن الطوارئ.
          </Text>
        </OasisSurface>

        <Pressable oasisKind="action" oasisVariant="primary" style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={16} color={OASIS.colors.surface} />
          <Text style={styles.backBtnText}>رجوع</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 14, gap: 12, maxWidth: 820, width: '100%', alignSelf: 'center' },
  hero: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#DDEAE4', backgroundColor: '#FFFFFF' },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#EAF5EF', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, alignItems: 'flex-end' },
  heroTitle: { color: '#1C1C1E', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  heroSub: { color: '#636366', fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 4 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#DDEAE4', backgroundColor: '#FFFFFF', gap: 8 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#1C1C1E', fontSize: 14, fontWeight: '800', textAlign: 'right', flex: 1 },
  bulletRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 6 },
  bullet: { color: OASIS.colors.primary, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  body: { color: '#1C1C1E', fontSize: 12.5, lineHeight: 20, textAlign: 'right', flex: 1 },
  backBtn: { minHeight: 44, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OASIS.colors.primary },
  backBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
});
