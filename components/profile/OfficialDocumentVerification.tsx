import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Building2, BriefcaseBusiness, CheckCircle2, ExternalLink, FileCheck2, LockKeyhole, RotateCcw, ShieldAlert, UploadCloud } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Kind = 'business' | 'freelance';
type Request = {
  id: string;
  verification_type: Kind;
  document_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const SERVICES: Record<Kind, { title: string; subtitle: string; url: string; placeholder: string; help: string }> = {
  business: {
    title: 'السجل التجاري',
    subtitle: 'وزارة التجارة السعودية',
    url: 'https://mc.gov.sa/ar/eservices/Pages/Commercial-data.aspx',
    placeholder: 'الرقم الوطني الموحد للمنشأة أو رقم السجل',
    help: 'ابحث عن المنشأة في وزارة التجارة، وتحقق من حالتها وبياناتها وارتباطك بها.',
  },
  freelance: {
    title: 'وثيقة العمل الحر',
    subtitle: 'منصة العمل الحر — وزارة الموارد البشرية',
    url: 'https://www.freelance.sa/ar/certificate-validation',
    placeholder: 'رقم وثيقة العمل الحر',
    help: 'تتطلب الخدمة الرسمية تسجيل الدخول عبر نفاذ، ثم إدخال رقم الوثيقة.',
  },
};

const EMPTY = { business: '', freelance: '' };
const EMPTY_FLAGS = { business: false, freelance: false };
const EMPTY_IMAGES: Record<Kind, ImagePicker.ImagePickerAsset | null> = { business: null, freelance: null };

function documentStatus(request?: Request) {
  if (!request) return { label: 'لم يُقدَّم', color: '#64748B', bg: '#F1F5F9' };
  if (request.status === 'approved') return { label: 'راجعته إدارة حيّنا', color: '#047857', bg: '#D1FAE5' };
  if (request.status === 'pending') return { label: 'بانتظار مراجعة الإدارة', color: '#A16207', bg: '#FEF3C7' };
  return { label: 'لم يُعتمد الطلب', color: '#B91C1C', bg: '#FEE2E2' };
}

export function OfficialDocumentVerification({ userId, kind, onSubmitted }: { userId: string; kind: Kind; onSubmitted?: () => void }) {
  const { colors } = useTheme();
  const [records, setRecords] = useState<Partial<Record<Kind, Request>>>({});
  const [numbers, setNumbers] = useState<Record<Kind, string>>({ ...EMPTY });
  const [names, setNames] = useState<Record<Kind, string>>({ ...EMPTY });
  const [checked, setChecked] = useState<Record<Kind, boolean>>({ ...EMPTY_FLAGS });
  const [attachments, setAttachments] = useState<Record<Kind, ImagePicker.ImagePickerAsset | null>>({ ...EMPTY_IMAGES });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [wathqLoading, setWathqLoading] = useState(false);
  const [wathqResult, setWathqResult] = useState<{ name: string | null; status: string | null; crNumber: string | null; crNationalNumber: string | null; city: string | null } | null>(null);
  const [wathqMessage, setWathqMessage] = useState('');
  const mounted = useRef(true);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('verification_requests')
        .select('id,verification_type,document_number,status,note,created_at,reviewed_at')
        .eq('user_id', userId)
        .in('verification_type', ['business', 'freelance'])
        .not('document_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (queryError) throw queryError;
      if (!mounted.current) return;
      const latest: Partial<Record<Kind, Request>> = {};
      for (const item of (data || []) as Request[]) {
        if (!latest[item.verification_type]) latest[item.verification_type] = item;
      }
      setRecords(latest);
      setError('');
    } catch {
      if (mounted.current) setError('تعذر تحميل حالة التوثيق. أعد المحاولة.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  async function lookupSandbox() {
    const id = numbers.business.trim();
    if (!/^[0-9]{10,15}$/.test(id)) {
      setWathqMessage('أدخل رقم سجل تجاري أو رقمًا وطنيًا موحدًا مكونًا من 10 إلى 15 رقمًا.');
      return;
    }
    if (wathqLoading) return;
    setWathqLoading(true);
    setWathqResult(null);
    setWathqMessage('');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) throw new Error('سجّل الدخول لاستخدام الاستعلام التجريبي.');
      const endpoint = Platform.OS === 'web'
        ? '/api/wathq-commercial'
        : 'https://appksatest.vercel.app/api/wathq-commercial';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.session.access_token,
        },
        body: JSON.stringify({ id, action: 'info' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'تعذر الاستعلام التجريبي.');
      setWathqResult({
        name: payload.name || null,
        status: payload.status || null,
        crNumber: payload.crNumber || null,
        crNationalNumber: payload.crNationalNumber || null,
        city: payload.city || null,
      });
      setWathqMessage('نتيجة من بيئة واثق التجريبية؛ لا تثبت صحة السجل الحقيقي أو ملكيته، ولا يتم توثيق الحساب بها.');
    } catch (err: any) {
      setWathqMessage(err?.message || 'فشل الاستعلام التجريبي. استخدم الخدمة الحكومية الرسمية.');
    } finally {
      setWathqLoading(false);
    }
  }

  async function selectAttachment(kind: Kind) {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setAttachments(previous => ({ ...previous, [kind]: result.assets[0] }));
    }
  }

  async function submit(kind: Kind) {
    const number = numbers[kind].replace(/\s/g, '').trim();
    const professionalName = names[kind].trim();
    if (inFlight.current || loading || records[kind]?.status === 'pending') return;
    if (!/^[A-Za-z0-9-]{6,30}$/.test(number)) {
      setError('أدخل رقم الوثيقة أو السجل بشكل صحيح (6 إلى 30 حرفًا أو رقمًا).');
      return;
    }
    if (professionalName.length < 2 || professionalName.length > 120) {
      setError('أدخل اسم المنشأة أو المجال المهني بشكل واضح.');
      return;
    }
    if (!checked[kind]) {
      setError('افتح الخدمة الرسمية، واستعلم عن الوثيقة أولًا، ثم أكّد أنك راجعت النتيجة.');
      return;
    }

    inFlight.current = true;
    setBusy(kind);
    setError('');
    setMessage('');
    let uploadedPath: string | null = null;
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || auth.user?.id !== userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول من جديد.');
      const attachment = attachments[kind];
      if (attachment) {
        const contentType = attachment.mimeType || 'image/jpeg';
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(contentType)) {
          throw new Error('اختر صورة JPG أو PNG أو WEBP أو HEIC فقط.');
        }
        const bytes = await (await fetch(attachment.uri)).arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('حجم المرفق يجب ألا يتجاوز 8 ميجابايت.');
        const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        uploadedPath = userId + '/' + Date.now() + '-' + kind + '-official.' + ext;
        const uploaded = await supabase.storage.from('verification-documents').upload(uploadedPath, bytes, {
          contentType,
          upsert: false,
        });
        if (uploaded.error) throw uploaded.error;
      }
      const created = await supabase.from('verification_requests').insert({
        user_id: userId,
        status: 'pending',
        verification_type: kind,
        subject: kind === 'business' ? 'merchant' : 'freelance',
        note: professionalName,
        document_number: number,
        attachment_url: uploadedPath,
        document_url: null,
      });
      if (created.error) throw created.error;
      if (!mounted.current) return;
      setNumbers(previous => ({ ...previous, [kind]: '' }));
      setNames(previous => ({ ...previous, [kind]: '' }));
      setChecked(previous => ({ ...previous, [kind]: false }));
      setAttachments(previous => ({ ...previous, [kind]: null }));
      setMessage('تم إرسال طلب ' + SERVICES[kind].title + ' للإدارة. لا تُمنح شارة توثيق قبل فحص المستند وصلاحية تمثيل المنشأة أو ملكية الوثيقة.');
      await load();
      onSubmitted?.();
    } catch (e: any) {
      if (uploadedPath) {
        await supabase.storage.from('verification-documents').remove([uploadedPath]);
      }
      if (mounted.current) {
        setError(e?.code === '23505'
          ? 'يوجد طلب قيد المراجعة لهذه الوثيقة. تحقق من حالته قبل إرسال طلب آخر.'
          : e?.message || 'تعذر إرسال الطلب. أعد المحاولة.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <View testID="official-document-verification" style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.titleRow}>
        <FileCheck2 color={colors.primary} size={22} />
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.title, { color: colors.ink }]}>{SERVICES[kind].title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{SERVICES[kind].subtitle} · المتطلبات الخاصة بهذا الحساب</Text>
        </View>
      </View>
      <View style={[styles.notice, { backgroundColor: colors.background, borderColor: colors.line }]}>
        <ShieldAlert color={colors.muted} size={17} />
        <Text style={[styles.description, { color: colors.muted, flex: 1 }]}>
          {kind === 'business'
            ? 'للتوثيق الفعلي استخدم وزارة التجارة ثم أرسل إثبات الصفة. واثق التجريبي ليس سجلًا حقيقيًا ولا يثبت ملكية المنشأة.'
            : 'تحقق من الوثيقة عبر منصة العمل الحر الرسمية، ثم أرفق إثباتها. لا يكفي رقم الوثيقة وحده لاعتماد الحساب.'}
        </Text>
      </View>

      {loading ? <ActivityIndicator accessibilityLabel="تحميل حالة التوثيق" color={colors.primary} /> : (() => {
        const svc = SERVICES[kind];
        const record = records[kind];
        const status = documentStatus(record);
        const disabled = busy !== null || record?.status === 'pending';
        const Icon = kind === 'business' ? Building2 : BriefcaseBusiness;
        return (
          <View key={kind} style={[styles.service, { backgroundColor: colors.background, borderColor: colors.line }]}>
            <View style={styles.serviceTop}>
              <Icon color={colors.primary} size={20} />
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={[styles.serviceTitle, { color: colors.ink }]}>{svc.title}</Text>
                <Text style={[styles.small, { color: colors.muted }]}>{svc.subtitle}</Text>
              </View>
              <View style={[styles.status, { backgroundColor: status.bg }]}>
                <Text style={{ color: status.color, fontWeight: '800', fontSize: 10 }}>{status.label}</Text>
              </View>
            </View>
            <Text style={[styles.description, { color: colors.muted }]}>{svc.help}</Text>
            {record ? (
              <View style={[styles.previous, { borderColor: colors.line }]}>
                <Text style={[styles.small, { color: colors.muted }]}>آخر طلب: {record.document_number} · {new Date(record.created_at).toLocaleDateString('ar-SA')}</Text>
                <Text style={[styles.small, { color: colors.muted }]}>
                  {record.status === 'approved' ? 'اعتماد إداري بعد المراجعة، وليس تكامل تحقق حكومي آلي.' :
                    record.status === 'rejected' ? 'يمكنك تعديل البيانات والتقديم من جديد.' : 'الطلب بانتظار التحقق من المصدر الرسمي.'}
                </Text>
              </View>
            ) : null}
            <Pressable accessibilityRole="link" accessibilityLabel={'فتح خدمة ' + svc.title + ' الرسمية'} onPress={() => {
              setError('');
              void Linking.openURL(svc.url).catch(() => setError('تعذر فتح الموقع الرسمي. حاول مرة أخرى.'));
            }} style={[styles.officialLink, { borderColor: colors.primary }]}>
              <ExternalLink size={16} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>فتح الاستعلام الرسمي مجانًا</Text>
            </Pressable>
            {record?.status !== 'pending' ? (
              <>
                <TextInput
                  accessibilityLabel={svc.placeholder}
                  value={numbers[kind]}
                  onChangeText={value => { setNumbers(previous => ({ ...previous, [kind]: value })); setError(''); }}
                  keyboardType="default"
                  autoCorrect={false}
                  autoCapitalize="characters"
                  maxLength={30}
                  editable={!disabled}
                  placeholder={svc.placeholder}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
                />
                {kind === 'business' ? (
                  <View style={[styles.sandboxPanel, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                    <Text style={[styles.small, { color: colors.muted }]}>فحص API تجريبي من واثق (بيانات اختبارية فقط). الخدمة الحقيقية تتطلب اشتراكًا إنتاجيًا.</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="استعلام واثق التجريبي" style={[styles.officialLink, { borderColor: colors.line }]} disabled={wathqLoading} onPress={() => void lookupSandbox()}>
                      {wathqLoading ? <ActivityIndicator color={colors.primary}/> : <FileCheck2 color={colors.primary} size={16} />}
                      <Text style={[styles.actionText, { color: colors.primary }]}>{wathqLoading ? 'جارٍ الاستعلام التجريبي' : 'فحص السجل عبر واثق التجريبي'}</Text>
                    </Pressable>
                    {!!wathqMessage && <Text accessibilityRole="alert" style={[styles.small, { color: colors.muted }]}>{wathqMessage}</Text>}
                    {wathqResult && <View style={styles.sandboxResult}>
                      <Text style={[styles.small, { color: colors.ink, fontWeight: '800' }]}>اسم تجريبي: {wathqResult.name || 'غير متوفر'}</Text>
                      <Text style={[styles.small, { color: colors.ink }]}>الحالة التجريبية: {wathqResult.status || 'غير متوفرة'}</Text>
                      <Text style={[styles.small, { color: colors.muted }]}>رقم السجل: {wathqResult.crNumber || '—'} · الرقم الوطني: {wathqResult.crNationalNumber || '—'}</Text>
                    </View>}
                  </View>
                ) : null}
                <TextInput
                  accessibilityLabel={kind === 'business' ? 'اسم المنشأة' : 'المجال المهني'}
                  value={names[kind]}
                  onChangeText={value => { setNames(previous => ({ ...previous, [kind]: value })); setError(''); }}
                  maxLength={120}
                  editable={!disabled}
                  placeholder={kind === 'business' ? 'اسم المنشأة كما يظهر في السجل' : 'المجال أو المهنة كما في الوثيقة'}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
                />
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked[kind] }} onPress={() => setChecked(previous => ({ ...previous, [kind]: !previous[kind] }))} style={styles.checkRow}>
                  <View style={[styles.checkBox, { borderColor: colors.primary, backgroundColor: checked[kind] ? colors.primary : colors.surface }]}>
                    {checked[kind] ? <CheckCircle2 color="#FFFFFF" size={15} /> : null}
                  </View>
                  <Text style={[styles.description, { color: colors.ink, flex: 1 }]}>تحققت بنفسي من البيانات في الموقع الحكومي وأوافق على مراجعتها من إدارة حيّنا.</Text>
                </Pressable>
                <Pressable accessibilityLabel={'إرفاق صورة إثبات ' + svc.title} onPress={() => void selectAttachment(kind)} disabled={disabled} style={[styles.attachment, { borderColor: colors.line }]}>
                  <UploadCloud size={16} color={colors.muted} />
                  <Text style={[styles.small, { color: colors.muted, flex: 1 }]}>
                    {attachments[kind]?.fileName || (attachments[kind] ? 'تم اختيار الصورة' : 'إرفاق صورة الإثبات (اختياري، خاص بالإدارة)')}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={'إرسال طلب مراجعة ' + svc.title} onPress={() => void submit(kind)} disabled={disabled} style={[styles.submit, { backgroundColor: disabled ? colors.line : colors.primary }]}>
                  {busy === kind ? <ActivityIndicator color="#FFFFFF" /> : <FileCheck2 size={16} color="#FFFFFF" />}
                  <Text style={styles.submitText}>{busy === kind ? 'جارٍ الإرسال…' : 'إرسال طلب المراجعة'}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        );
      })()}
      {!!message && <Text accessibilityRole="alert" style={[styles.description, { color: '#047857' }]}>{message}</Text>}
      {!!error && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={[styles.description, { color: colors.danger }]}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry}><RotateCcw size={15} color={colors.primary} /><Text style={[styles.small, { color: colors.primary }]}>إعادة تحميل حالة التوثيق</Text></Pressable></View>}
      <View style={styles.footer}>
        <LockKeyhole size={14} color={colors.muted} />
        <Text style={[styles.small, { color: colors.muted, flex: 1 }]}>الرقم والمرفقات متاحة لك ولموظفي المراجعة المخوّلين فقط. لا ترفع صورة الهوية الوطنية.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'right' },
  description: { fontSize: 12, lineHeight: 20, textAlign: 'right' },
  small: { fontSize: 11, lineHeight: 18, textAlign: 'right' },
  notice: { borderWidth: 1, borderRadius: 13, padding: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  service: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 11 },
  sandboxPanel: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 10 },
  sandboxResult: { padding: 10, borderRadius: 10, gap: 3, backgroundColor: '#FFF7ED' },
  expandArrow: { fontSize: 24, fontWeight: '500', minWidth: 20, textAlign: 'center' },
  serviceTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  serviceTitle: { fontSize: 14, fontWeight: '800', textAlign: 'right' },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  officialLink: { borderWidth: 1, borderRadius: 12, minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12 },
  actionText: { fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 13, textAlign: 'right' },
  checkRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 38 },
  checkBox: { height: 22, width: 22, borderWidth: 1.5, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  attachment: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, flexDirection: 'row-reverse', gap: 8, alignItems: 'center', padding: 12 },
  submit: { minHeight: 46, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  previous: { borderTopWidth: 1, paddingTop: 9, gap: 4 },
  footer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  retry: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
});
