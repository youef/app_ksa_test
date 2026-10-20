import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  CircleHelp,
  Clock3,
  FileCheck2,
  ImagePlus,
  Lightbulb,
  LockKeyhole,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
  X,
  XCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AccountIdentityBadge, type AccountKind } from '@/components/profile/AccountIdentityBadge';

type VerificationRequest = {
  id: string;
  status: string | null;
  subject: string | null;
  verification_type: string | null;
  note: string | null;
  attachment_url: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type EvidenceAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

const TYPES: {
  key: AccountKind;
  label: string;
  short: string;
  description: string;
  icon: any;
  tint: string;
  iconColor: string;
  requirements: string;
  verificationLabel: string;
}[] = [
  {
    key: 'standard',
    label: 'فردي',
    short: 'حساب شخصي',
    description: 'للسكان والأفراد المشاركين في مجتمع الحي.',
    icon: UserRound,
    tint: '#ECFDF5',
    iconColor: '#047857',
    requirements: 'يمكن طلب توثيق الحساب الفردي بشكل مستقل. رفع صورة إثبات داعمة اختياري.',
    verificationLabel: 'توثيق هوية فردية',
  },
  {
    key: 'merchant',
    label: 'مؤسسة أو نشاط تجاري',
    short: 'متجر أو منشأة',
    description: 'للمتاجر والمؤسسات والأنشطة التجارية المحلية.',
    icon: Store,
    tint: '#ECFDF5',
    iconColor: '#047857',
    requirements: 'اكتب اسم النشاط وارفع صورة سجل تجاري أو مستند داعم عند توفره.',
    verificationLabel: 'توثيق نشاط تجاري',
  },
  {
    key: 'freelance',
    label: 'عمل حر',
    short: 'مستقل أو مهني',
    description: 'لأصحاب وثائق العمل الحر والمهن المستقلة.',
    icon: BriefcaseBusiness,
    tint: '#EFF6FF',
    iconColor: '#2563EB',
    requirements: 'اكتب تخصصك وارفع صورة وثيقة العمل الحر أو إثبات مهني.',
    verificationLabel: 'توثيق عمل حر',
  },
  {
    key: 'provider',
    label: 'مقدم خدمة',
    short: 'خدمات الحي',
    description: 'للفنيين والحرفيين ومقدمي الخدمات المهنية.',
    icon: Wrench,
    tint: '#F5F3FF',
    iconColor: '#7C3AED',
    requirements: 'اكتب نوع الخدمة وارفع أي ترخيص أو إثبات خبرة مناسب إن وجد.',
    verificationLabel: 'توثيق مقدم خدمة',
  },
  {
    key: 'idea',
    label: 'مبادرة أو مشروع ناشئ',
    short: 'فكرة ومبادرة',
    description: 'للمبادرات والمشاريع الناشئة التي تريد حضورًا موثوقًا في المجتمع.',
    icon: Lightbulb,
    tint: '#FFFBEB',
    iconColor: '#B45309',
    requirements: 'اكتب اسم المبادرة أو المشروع وما يثبت صفته عند توفره.',
    verificationLabel: 'توثيق مبادرة',
  },
];

function requestLabel(status?: string | null) {
  const s = (status || 'pending').toLowerCase();
  if (['approved', 'accepted', 'verified', 'completed'].includes(s)) {
    return { label: 'تمت الموافقة', color: '#047857', bg: '#D1FAE5', icon: Check };
  }
  if (['rejected', 'declined', 'denied'].includes(s)) {
    return { label: 'يحتاج إلى تعديل', color: '#B91C1C', bg: '#FEE2E2', icon: XCircle };
  }
  if (['reviewing', 'in_review', 'under_review', 'processing'].includes(s)) {
    return { label: 'قيد المراجعة', color: '#1D4ED8', bg: '#DBEAFE', icon: Clock3 };
  }
  return { label: 'بانتظار المراجعة', color: '#92400E', bg: '#FEF3C7', icon: Clock3 };
}

function accountLabel(value?: string | null) {
  return TYPES.find((item) => item.key === value)?.label || 'فردي';
}

function isPendingStatus(status?: string | null) {
  return !['approved', 'accepted', 'verified', 'completed', 'rejected', 'declined', 'denied'].includes(
    (status || 'pending').toLowerCase(),
  );
}

export default function AccountTypeScreen() {
  const bottomNavInset = useBottomNavInset();
  const params = useLocalSearchParams<{ type?: string }>();
  const requestedTypeParam = Array.isArray(params.type) ? params.type[0] : params.type;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<AccountKind>('standard');
  const [currentType, setCurrentType] = useState<AccountKind>('standard');
  const [trade, setTrade] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [role, setRole] = useState<string>('user');
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [evidence, setEvidence] = useState<EvidenceAsset | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const selected = useMemo(() => TYPES.find((item) => item.key === type) || TYPES[0], [type]);
  const requestedType = useMemo<AccountKind | null>(() => {
    return TYPES.some((item) => item.key === requestedTypeParam)
      ? (requestedTypeParam as AccountKind)
      : null;
  }, [requestedTypeParam]);
  const pendingRequest = useMemo(() => requests.find((item) => isPendingStatus(item.status)), [requests]);
  const latestRequest = requests[0] || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        router.replace('/auth');
        return;
      }

      setUserId(auth.user.id);
      const [profileRes, requestRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('account_type,freelance_trade,display_name,is_verified,role')
          .eq('id', auth.user.id)
          .maybeSingle(),
        supabase
          .from('verification_requests')
          .select('id,status,subject,verification_type,note,attachment_url,created_at,reviewed_at')
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (requestRes.error) throw requestRes.error;

      const savedType = (profileRes.data?.account_type || 'standard') as AccountKind;
      setCurrentType(savedType);
      setType(requestedType || savedType);
      setTrade(profileRes.data?.freelance_trade || '');
      setDisplayName(profileRes.data?.display_name || '');
      setIsVerified(Boolean(profileRes.data?.is_verified));
      setRole(profileRes.data?.role || 'user');
      setRequests((requestRes.data || []) as VerificationRequest[]);
    } catch (e) {
      Alert.alert('تعذّر تحميل بيانات الحساب', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [requestedType]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickEvidence = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.88,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setEvidence({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || null,
    });
  };

  const uploadEvidence = async () => {
    if (!evidence || !userId) return null;

    const response = await fetch(evidence.uri);
    const bytes = await response.arrayBuffer();
    const mimeType = evidence.mimeType || 'image/jpeg';
    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/heic'
            ? 'heic'
            : 'jpg';
    const path =
      userId +
      '/' +
      Date.now().toString() +
      '-' +
      type +
      '-' +
      Math.random().toString(36).slice(2, 8) +
      '.' +
      extension;

    const upload = await supabase.storage.from('verification-documents').upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '3600',
    });
    if (upload.error) throw upload.error;
    return path;
  };

  const submit = async () => {
    if (!userId) {
      router.replace('/auth');
      return;
    }

    if (pendingRequest) {
      Alert.alert('لديك طلب قيد المراجعة', 'انتظر قرار الإدارة على الطلب الحالي قبل تقديم طلب جديد.');
      return;
    }

    if (type === 'standard' && currentType !== 'standard') {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ account_type: 'standard', freelance_trade: null })
          .eq('id', userId);
        if (error) throw error;
        setCurrentType('standard');
        setTrade('');
        setEvidence(null);
        Alert.alert('تم التحويل إلى حساب فردي', 'تم إلغاء الصفة المهنية من العرض العام. شارة التوثيق العامة لا تتغير.');
        await load();
      } catch (e) {
        Alert.alert('تعذّر تحديث نوع الحساب', e instanceof Error ? e.message : 'حاول مرة أخرى.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (type === 'standard' && isVerified) {
      Alert.alert('حسابك موثّق', 'حسابك الفردي يحمل توثيقًا رسميًا بالفعل.');
      return;
    }

    if (type !== 'standard' && trade.trim().length < 2) {
      Alert.alert('أكمل بيانات النشاط', 'اكتب اسم النشاط أو التخصص حتى يتمكن فريق المراجعة من فهم طلبك.');
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadEvidence();

      const verificationType =
        type === 'standard' ? 'identity' : type === 'freelance' ? 'freelance' : 'business';
      const note =
        type === 'standard'
          ? trade.trim() || displayName || 'طلب توثيق حساب فردي'
          : trade.trim();

      const { error } = await supabase.from('verification_requests').insert({
        user_id: userId,
        verification_type: verificationType,
        note,
        subject: type,
        attachment_url: uploadedPath,
        document_url: null,
        status: 'pending',
      });
      if (error) throw error;

      setEvidence(null);
      Alert.alert(
        'تم إرسال طلب التوثيق',
        'طلبك الآن بانتظار مراجعة الإدارة. لن تتغير الصفة أو الشارة المهنية إلا بعد الموافقة.',
      );
      await load();
    } catch (e) {
      if (uploadedPath) {
        await supabase.storage.from('verification-documents').remove([uploadedPath]);
      }
      Alert.alert('تعذّر إرسال الطلب', e instanceof Error ? e.message : 'تحقق من البيانات وحاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={styles.loadingText}>جارٍ تحميل هوية الحساب...</Text>
      </View>
    );
  }

  const CurrentIcon = TYPES.find((item) => item.key === currentType)?.icon || UserRound;

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="sub"
        title="هوية الحساب والتوثيق"
        subtitle="اختر صفتك، ثم يراجعها فريق حيّنا قبل اعتمادها"
        fallbackRoute="/profile"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 32 }]}
      >
        <LinearGradient colors={['#064E3B', '#047857', '#059669']} style={styles.hero}>
          <View style={styles.heroIcon}>
            <CurrentIcon size={25} color="#FFFFFF" />
          </View>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroEyebrow}>هويتك الحالية في حيّنا</Text>
            <View style={styles.heroIdentityRow}>
              <Text style={styles.heroTitle}>{accountLabel(currentType)}</Text>
              {isVerified ? <BadgeCheck size={18} color="#A7F3D0" /> : null}
            </View>
            <Text style={styles.heroSub}>
              {isVerified ? 'تمت مراجعة هذا الحساب ومنحه توثيقًا رسميًا.' : 'يمكنك طلب التوثيق أو تغيير الصفة المهنية أدناه.'}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleCol}>
              <Text style={styles.summaryTitle}>الصفة الظاهرة للآخرين</Text>
              <Text style={styles.summarySub}>تتغير تلقائيًا بعد اعتماد الإدارة.</Text>
            </View>
            <AccountIdentityBadge role={role} accountType={currentType} isVerified={isVerified} />
          </View>

          <View style={styles.summarySteps}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, styles.stepDone]}><Check size={12} color="#FFFFFF" /></View>
              <Text style={styles.stepText}>اختيار الصفة</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, pendingRequest ? styles.stepActive : latestRequest?.status === 'approved' ? styles.stepDone : styles.stepIdle]}>
                {pendingRequest ? <Clock3 size={12} color="#FFFFFF" /> : latestRequest?.status === 'approved' ? <Check size={12} color="#FFFFFF" /> : <FileCheck2 size={12} color="#64748B" />}
              </View>
              <Text style={styles.stepText}>مراجعة الإدارة</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, isVerified ? styles.stepDone : styles.stepIdle]}>
                {isVerified ? <BadgeCheck size={12} color="#FFFFFF" /> : <ShieldCheck size={12} color="#64748B" />}
              </View>
              <Text style={styles.stepText}>اعتماد الشارة</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>اختر نوع الحساب</Text>
          <Text style={styles.sectionSub}>النوع المطلوب لا يظهر للعامة حتى تتم الموافقة عليه.</Text>
        </View>

        <View style={styles.typeGrid}>
          {TYPES.map((item) => {
            const active = type === item.key;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setType(item.key);
                  setEvidence(null);
                  if (item.key === currentType) setTrade(item.key === 'standard' ? '' : trade);
                }}
                style={[styles.typeCard, active && styles.typeCardActive]}
              >
                <View style={styles.typeTop}>
                  <View style={[styles.typeIcon, { backgroundColor: item.tint }]}>
                    <Icon size={23} color={item.iconColor} />
                  </View>
                  {active ? (
                    <View style={styles.selectedBadge}><Check size={13} color="#FFFFFF" /></View>
                  ) : (
                    <View style={styles.unselectedCircle} />
                  )}
                </View>
                <Text style={styles.typeLabel}>{item.label}</Text>
                <Text style={styles.typeShort}>{item.short}</Text>
                <Text style={styles.typeDesc}>{item.description}</Text>
                {currentType === item.key ? (
                  <View style={styles.currentLine}>
                    <ShieldCheck size={13} color="#047857" />
                    <Text style={styles.currentText}>الصفة الحالية</Text>
                  </View>
                ) : active ? (
                  <View style={styles.typeSelectedLine}>
                    <Check size={13} color="#047857" />
                    <Text style={styles.typeSelectedText}>محدد للطلب</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {(type !== 'standard' || (type === 'standard' && currentType === 'standard' && !isVerified)) ? (
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <View style={styles.formIcon}><FileCheck2 size={19} color="#047857" /></View>
              <View style={styles.formHeadingText}>
                <Text style={styles.formTitle}>{selected.verificationLabel}</Text>
                <Text style={styles.formSub}>المراجعة يدوية، ولن تتغير الشارة قبل اعتماد الطلب.</Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>
              {type === 'standard'
                ? 'الاسم الكامل أو ملاحظة للمراجع'
                : type === 'merchant'
                  ? 'اسم المؤسسة أو النشاط التجاري'
                  : type === 'freelance'
                    ? 'المهنة أو تخصص العمل الحر'
                    : type === 'provider'
                      ? 'الخدمة التي تقدمها'
                      : 'اسم المبادرة أو المشروع'}
            </Text>
            <TextInput
              value={trade}
              onChangeText={setTrade}
              maxLength={120}
              placeholder={
                type === 'standard'
                  ? displayName || 'اسمك كما تريد أن يراجعه فريق التوثيق'
                  : type === 'merchant'
                    ? 'مثال: مؤسسة النخبة للصيانة'
                    : type === 'freelance'
                      ? 'مثال: تصميم جرافيك'
                      : type === 'provider'
                        ? 'مثال: صيانة أجهزة منزلية'
                        : 'مثال: مبادرة تشجير الحي'
              }
              placeholderTextColor="#94A3B8"
              style={styles.input}
              textAlign="right"
            />

            <Text style={styles.fieldLabel}>صورة إثبات داعمة</Text>
            {evidence ? (
              <View style={styles.evidencePreview}>
                <Image source={{ uri: evidence.uri }} style={styles.evidenceImage} />
                <View style={styles.evidenceMeta}>
                  <View style={styles.evidenceReadyRow}>
                    <ShieldCheck size={15} color="#047857" />
                    <Text style={styles.evidenceReady}>جاهزة للرفع بشكل خاص</Text>
                  </View>
                  <Text style={styles.evidenceHint} numberOfLines={2}>
                    لا تظهر هذه الصورة للعامة، ويصل إليها فريق المراجعة المخوّل فقط.
                  </Text>
                </View>
                <Pressable onPress={() => setEvidence(null)} style={styles.removeEvidence}>
                  <X size={16} color="#DC2626" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.uploadBox} onPress={() => void pickEvidence()}>
                <View style={styles.uploadIcon}><ImagePlus size={22} color="#047857" /></View>
                <View style={styles.uploadTextCol}>
                  <Text style={styles.uploadTitle}>اختر صورة من جهازك</Text>
                  <Text style={styles.uploadSub}>JPEG / PNG / WEBP / HEIC — حتى 8 MB</Text>
                </View>
                <ChevronLeft size={17} color="#64748B" />
              </Pressable>
            )}

            <View style={styles.requirements}>
              <CircleHelp size={16} color="#64748B" />
              <Text style={styles.requirementsText}>{selected.requirements}</Text>
            </View>

            <View style={styles.privacyBox}>
              <LockKeyhole size={17} color="#047857" />
              <Text style={styles.privacyText}>
                مستندات التحقق محفوظة في مساحة خاصة ومحمية بالصلاحيات، وليست ملفات عامة على الإنترنت.
              </Text>
            </View>
          </View>
        ) : null}

        <Pressable
          disabled={saving || Boolean(pendingRequest) || (type === 'standard' && currentType === 'standard' && isVerified)}
          onPress={() => void submit()}
          style={[
            styles.submitButton,
            (saving || Boolean(pendingRequest) || (type === 'standard' && currentType === 'standard' && isVerified)) && styles.submitDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitText}>
                {pendingRequest
                  ? 'طلبك قيد المراجعة'
                  : type === 'standard' && currentType !== 'standard'
                    ? 'التحويل إلى حساب فردي'
                    : type === 'standard' && isVerified
                      ? 'الحساب الفردي موثّق'
                      : 'إرسال طلب التوثيق'}
              </Text>
              {pendingRequest ? <Clock3 size={17} color="#FFFFFF" /> : <ChevronLeft size={17} color="#FFFFFF" />}
            </>
          )}
        </Pressable>

        {requests.length ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>سجل طلبات التوثيق</Text>
            <Text style={styles.historySub}>يعرض آخر الطلبات وقرار الإدارة لكل طلب.</Text>
            {requests.map((request) => {
              const status = requestLabel(request.status);
              const StatusIcon = status.icon;
              return (
                <View key={request.id} style={styles.historyItem}>
                  <View style={[styles.statusIcon, { backgroundColor: status.bg }]}>
                    <StatusIcon size={15} color={status.color} />
                  </View>
                  <View style={styles.historyText}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyKind}>{accountLabel(request.subject)}</Text>
                      <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyNote} numberOfLines={2}>
                      {request.note || 'بدون ملاحظة إضافية'}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(request.created_at).toLocaleDateString('ar-SA')}
                      {request.reviewed_at ? ' · تمت المراجعة ' + new Date(request.reviewed_at).toLocaleDateString('ar-SA') : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  hero: { borderRadius: 24, padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, overflow: 'hidden' },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  heroTextCol: { flex: 1, alignItems: 'flex-end', gap: 4 },
  heroEyebrow: { color: '#A7F3D0', fontSize: 11, fontWeight: '800' },
  heroIdentityRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  heroSub: { color: '#D1FAE5', fontSize: 12, lineHeight: 19, fontWeight: '600', textAlign: 'right' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', gap: 15 },
  summaryHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  summaryTitleCol: { flex: 1, alignItems: 'flex-end', gap: 2 },
  summaryTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  summarySub: { color: '#64748B', fontSize: 11, fontWeight: '600', textAlign: 'right' },
  summarySteps: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', gap: 5, minWidth: 72 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: '#059669' },
  stepActive: { backgroundColor: '#D97706' },
  stepIdle: { backgroundColor: '#E2E8F0' },
  stepText: { color: '#475569', fontSize: 9.5, fontWeight: '800', textAlign: 'center' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 3 },
  sectionHeader: { alignItems: 'flex-end', gap: 3, paddingTop: 4 },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  sectionSub: { color: '#64748B', fontSize: 11.5, fontWeight: '600', textAlign: 'right' },
  typeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '48.5%', minHeight: 170, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 13, borderWidth: 1.2, borderColor: '#E2E8F0', alignItems: 'flex-end', gap: 5 },
  typeCardActive: { borderColor: '#059669', backgroundColor: '#F0FDF4' },
  typeTop: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  typeIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  selectedBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  unselectedCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1' },
  typeLabel: { color: '#0F172A', fontSize: 14, fontWeight: '900', textAlign: 'right', marginTop: 3 },
  typeShort: { color: '#047857', fontSize: 10.5, fontWeight: '800', textAlign: 'right' },
  typeDesc: { color: '#64748B', fontSize: 10.5, lineHeight: 17, fontWeight: '600', textAlign: 'right' },
  currentLine: { marginTop: 'auto', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  currentText: { color: '#047857', fontSize: 9.5, fontWeight: '900' },
  typeSelectedLine: { marginTop: 'auto', flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  typeSelectedText: { color: '#047857', fontSize: 9.5, fontWeight: '900' },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#DCE7E2', gap: 11 },
  formHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  formIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  formHeadingText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  formTitle: { color: '#0F172A', fontSize: 14.5, fontWeight: '900' },
  formSub: { color: '#64748B', fontSize: 10.5, fontWeight: '600', textAlign: 'right' },
  fieldLabel: { color: '#334155', fontSize: 11.5, fontWeight: '800', textAlign: 'right', marginTop: 2 },
  input: { minHeight: 46, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 13, paddingHorizontal: 13, color: '#0F172A', fontSize: 13, fontWeight: '700' },
  uploadBox: { minHeight: 72, backgroundColor: '#F8FAFC', borderWidth: 1, borderStyle: 'dashed', borderColor: '#94A3B8', borderRadius: 15, padding: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  uploadIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  uploadTextCol: { flex: 1, alignItems: 'flex-end', gap: 3 },
  uploadTitle: { color: '#0F172A', fontSize: 12.5, fontWeight: '900' },
  uploadSub: { color: '#64748B', fontSize: 10.5, fontWeight: '600' },
  evidencePreview: { minHeight: 90, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 15, padding: 9, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  evidenceImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E2E8F0' },
  evidenceMeta: { flex: 1, alignItems: 'flex-end', gap: 5 },
  evidenceReadyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  evidenceReady: { color: '#047857', fontSize: 11.5, fontWeight: '900' },
  evidenceHint: { color: '#64748B', fontSize: 10.5, lineHeight: 17, textAlign: 'right', fontWeight: '600' },
  removeEvidence: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  requirements: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10 },
  requirementsText: { flex: 1, color: '#64748B', fontSize: 10.5, lineHeight: 17, fontWeight: '600', textAlign: 'right' },
  privacyBox: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 13, padding: 10, borderWidth: 1, borderColor: '#D1FAE5' },
  privacyText: { flex: 1, color: '#065F46', fontSize: 10.5, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  submitButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#047857', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitDisabled: { opacity: 0.58 },
  submitText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, borderWidth: 1, borderColor: '#E2E8F0', gap: 10 },
  historyTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  historySub: { color: '#64748B', fontSize: 10.5, fontWeight: '600', textAlign: 'right', marginBottom: 2 },
  historyItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  statusIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  historyText: { flex: 1, alignItems: 'stretch', gap: 4 },
  historyTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  historyKind: { flex: 1, color: '#0F172A', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9.5, fontWeight: '900' },
  historyNote: { color: '#475569', fontSize: 10.5, lineHeight: 17, fontWeight: '600', textAlign: 'right' },
  historyDate: { color: '#94A3B8', fontSize: 9.5, fontWeight: '700', textAlign: 'right' },
});
