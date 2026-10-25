import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageBackground, ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Camera,
  Check,
  ChevronLeft,
  Gift,
  ImagePlus,
  Package,
  ShoppingBag,
  Store,
  Wrench,
  X,
} from 'lucide-react-native';

import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { getPermanentMyLocation, isAllKingdom } from '@/lib/locationSync';
import {
  type LocalServiceImage,
  pickServiceImages,
  uploadServiceImages,
} from '@/lib/serviceUpload';

type Kind = 'product' | 'service';
type ProductMode = 'بيع' | 'تبرع' | 'إعارة';

export default function NewListing() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const requestedKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<any>({});
  const [profile, setProfile] = useState<any>(null);
  const [kind, setKind] = useState<Kind | null>(requestedKind === 'product' || requestedKind === 'service' ? requestedKind : null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<ProductMode>('بيع');
  const [image, setImage] = useState<LocalServiceImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          router.replace('/auth');
          return;
        }
        const [p, caps, loc] = await Promise.all([
          supabase.from('profiles').select('id,account_type,is_verified,display_name,freelance_trade,city,district').eq('id', auth.user.id).maybeSingle(),
          supabase.rpc('hayna_my_account_capabilities'),
          getPermanentMyLocation(),
        ]);
        setProfile(p.data || null);
        setCapabilities(caps.data || {});
        setCity(p.data?.city || (loc?.city && !isAllKingdom(loc.city) ? loc.city : ''));
        setDistrict(p.data?.district || (loc?.district && loc.district !== 'كل الأحياء' ? loc.district : ''));

        if (requestedKind === 'service') {
          if (!caps.data?.can_publish_services) {
            Alert.alert('يتطلب حسابًا مهنيًا', 'الخدمات متاحة للحساب التجاري أو العمل الحر أو مقدم الخدمة بعد اعتماد الإدارة.');
            router.replace({ pathname: '/profile', params: { tab: 'profile' } });
            return;
          }
          router.replace('/new-service');
          return;
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [requestedKind]);

  const isMerchant = profile?.account_type === 'merchant' && profile?.is_verified;
  const ownerLabel = useMemo(() => {
    if (isMerchant) return profile?.freelance_trade || profile?.display_name || 'المنشأة';
    return profile?.display_name || 'حسابك';
  }, [isMerchant, profile]);

  function chooseKind(next: Kind) {
    if (next === 'service') {
      if (!capabilities.can_publish_services) {
        Alert.alert('الخدمات للحسابات المهنية', 'حوّل نوع حسابك إلى عمل حر أو مقدم خدمة أو تجاري من مركز الحساب، ثم انتظر اعتماد الإدارة.');
        return;
      }
      router.replace('/new-service');
      return;
    }
    setKind('product');
  }

  async function chooseImage(fromCamera = false) {
    try {
      const result = await pickServiceImages(1, fromCamera);
      if (result[0]) setImage(result[0]);
    } catch (error: any) {
      Alert.alert('الصورة', error?.message || 'تعذر اختيار الصورة.');
    }
  }

  async function saveProduct() {
    if (!profile?.id || busy) return;
    if (!title.trim()) return Alert.alert('العنوان مطلوب', 'اكتب اسم المنتج أو السلعة.');
    if (!description.trim()) return Alert.alert('التفاصيل مطلوبة', 'اكتب وصفًا واضحًا للمنتج.');
    if (!city.trim()) return Alert.alert('المدينة مطلوبة', 'حدّث موقع حسابك من مركز الحساب أولًا.');
    if (mode === 'بيع' && price.trim() && !/^\d+(\.\d{1,2})?$/.test(price.trim())) {
      return Alert.alert('السعر غير صحيح', 'اكتب رقمًا صحيحًا مثل 50 أو 75.50.');
    }

    setBusy(true);
    try {
      const urls = image ? await uploadServiceImages(profile.id, [image]) : [];
      const inserted = await supabase.from('marketplace_items').insert({
        seller_id: profile.id,
        title: title.trim(),
        description: description.trim(),
        price: mode === 'بيع' && price.trim() ? Number(price) : null,
        item_type: isMerchant ? 'منتج تجاري' : mode,
        city: city.trim(),
        district: district.trim() || null,
        image_url: urls[0] || null,
        status: 'available',
      }).select('id').single();
      if (inserted.error) throw inserted.error;

      Alert.alert('تم النشر', isMerchant ? 'تم ربط المنتج بمنشأتك وحسابك تلقائيًا.' : 'تم ربط الإعلان بملفك الشخصي.');
      router.replace({ pathname: '/profile', params: { tab: 'content' } });
    } catch (error: any) {
      Alert.alert('تعذر نشر المنتج', error?.message || 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={OASIS.colors.primary} /><Text style={styles.loading}>جاري تجهيز الإضافة...</Text></View>;
  }

  if (!kind) {
    return (
      <View style={styles.screen}>
        <AppHeader variant="sub" title="إضافة جديدة" subtitle="اختر نوع ما تريد نشره" fallbackRoute="/profile?tab=content" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heroTitle}>ماذا تريد أن تضيف؟</Text>
          <Text style={styles.heroSub}>كل عنصر ينشر من هنا يرتبط بملفك تلقائيًا، وبمنشأتك إذا كان حسابك تجاريًا.</Text>

          <Pressable oasisKind="card" style={styles.kindCard} onPress={() => chooseKind('product')}>
            <View style={[styles.kindIcon, { backgroundColor: OASIS.colors.soft }]}><ShoppingBag size={26} color={OASIS.colors.primary} /></View>
            <View style={styles.kindCopy}>
              <Text style={styles.kindTitle}>منتج أو سلعة</Text>
              <Text style={styles.kindSub}>{isMerchant ? 'منتج تجاري باسم منشأتك' : 'بيع شخصي أو تبرع أو إعارة'}</Text>
            </View>
            <ChevronLeft size={20} color="#94A3B8" />
          </Pressable>

          <Pressable oasisKind="card" style={[styles.kindCard, !capabilities.can_publish_services && styles.kindDisabled]} onPress={() => chooseKind('service')}>
            <View style={[styles.kindIcon, { backgroundColor: OASIS.colors.infoSoft }]}><Wrench size={26} color="#2563EB" /></View>
            <View style={styles.kindCopy}>
              <Text style={styles.kindTitle}>خدمة مهنية</Text>
              <Text style={styles.kindSub}>{capabilities.can_publish_services ? 'أضف خدمة وربطها بحسابك المهني' : 'تتطلب حسابًا مهنيًا معتمدًا'}</Text>
            </View>
            <ChevronLeft size={20} color="#94A3B8" />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="إضافة منتج" subtitle={isMerchant ? 'سيظهر باسم المنشأة في السوق' : 'إعلان شخصي مرتبط بملفك'} fallbackRoute="/profile?tab=content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <OasisSurface oasisSurface="card" style={styles.ownerCard}>
          <View style={styles.ownerIcon}>{isMerchant ? <Store size={19} color={OASIS.colors.primary} /> : <Package size={19} color={OASIS.colors.primary} />}</View>
          <View style={styles.ownerCopy}>
            <Text style={styles.ownerLabel}>{isMerchant ? 'ينشر بواسطة المنشأة' : 'ينشر بواسطة الحساب'}</Text>
            <Text style={styles.ownerName}>{ownerLabel}</Text>
          </View>
          <Check size={18} color={OASIS.colors.primary} />
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={styles.card}>
          <Text style={styles.sectionTitle}>الصورة</Text>
          {image ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <Pressable style={styles.removeImage} onPress={() => setImage(null)}><X size={15} color={OASIS.colors.danger} /></Pressable>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <Pressable style={styles.imageButton} onPress={() => void chooseImage(false)}><ImagePlus size={20} color="#0F766E" /><Text style={styles.imageButtonText}>اختيار صورة</Text></Pressable>
              <Pressable style={styles.imageButton} onPress={() => void chooseImage(true)}><Camera size={20} color="#0F766E" /><Text style={styles.imageButtonText}>الكاميرا</Text></Pressable>
            </View>
          )}
        </OasisSurface>

        {!isMerchant ? (
          <OasisSurface oasisSurface="card" style={styles.card}>
            <Text style={styles.sectionTitle}>نوع الإعلان</Text>
            <View style={styles.modeRow}>
              {([
                ['بيع', ShoppingBag],
                ['تبرع', Gift],
                ['إعارة', Package],
              ] as const).map(([value, Icon]) => (
                <Pressable key={value} style={[styles.mode, mode === value && styles.modeActive]} onPress={() => setMode(value)}>
                  <Icon size={16} color={mode === value ? OASIS.colors.surface : OASIS.colors.muted} />
                  <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </OasisSurface>
        ) : null}

        <OasisSurface oasisSurface="card" style={styles.card}>
          <Field label="اسم المنتج" value={title} onChangeText={setTitle} placeholder="مثال: طاولة قهوة خشبية" />
          <Field label="الوصف" value={description} onChangeText={setDescription} placeholder="الحالة، التفاصيل، طريقة الاستلام..." multiline />
          {mode === 'بيع' || isMerchant ? <Field label="السعر (ر.س)" value={price} onChangeText={setPrice} placeholder="مثال: 150" keyboardType="decimal-pad" /> : null}
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={styles.card}>
          <Field label="المدينة" value={city} onChangeText={setCity} />
          <Field label="الحي" value={district} onChangeText={setDistrict} />
          <Text style={styles.hint}>يمكنك تعديل الموقع الأساسي من مركز حسابك، وهو المصدر الرئيسي لكل المحتوى.</Text>
        </OasisSurface>

        <Pressable oasisVariant="primary" oasisKind="action" style={styles.submit} onPress={() => void saveProduct()} disabled={busy}>

          {busy ? <ActivityIndicator color={OASIS.colors.surface} /> : <ShoppingBag size={18} color={OASIS.colors.surface} />}
          <Text style={styles.submitText}>نشر المنتج</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, multiline, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} multiline={multiline} textAlign="right" placeholderTextColor="#94A3B8" style={[styles.input, multiline && styles.multiline]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F7F9F8' },
  loading: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '700' },
  content: { padding: 15, paddingBottom: 24, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 12 },
  heroTitle: { color: OASIS.colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  heroSub: { color: OASIS.colors.muted, fontSize: 11.5, lineHeight: 19, textAlign: 'right', marginBottom: 5 },
  kindCard: { minHeight: 78, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, padding: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  kindDisabled: { opacity: 0.55 },
  kindIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kindCopy: { flex: 1, alignItems: 'flex-end' },
  kindTitle: { color: OASIS.colors.ink, fontSize: 14, fontWeight: '700' },
  kindSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 3, textAlign: 'right' },
  ownerCard: { minHeight: 64, borderRadius: 16, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderColor: OASIS.colors.soft, padding: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  ownerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  ownerCopy: { flex: 1, alignItems: 'flex-end' },
  ownerLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  ownerName: { color: OASIS.colors.deep, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, padding: 13, gap: 11 },
  sectionTitle: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  imageActions: { flexDirection: 'row-reverse', gap: 8 },
  imageButton: { flex: 1, minHeight: 72, borderRadius: 14, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center', gap: 5 },
  imageButtonText: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  imagePreview: { height: 210, borderRadius: 15, overflow: 'hidden', position: 'relative', backgroundColor: '#F1F5F9' },
  image: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 8, left: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row-reverse', gap: 7 },
  mode: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#F1F5F9', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modeActive: { backgroundColor: '#0F766E' },
  modeText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: OASIS.colors.surface },
  field: { gap: 5 },
  label: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 44, borderRadius: 12, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line, paddingHorizontal: 11, color: OASIS.colors.ink, fontSize: 12, fontWeight: '700' },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 10 },
  hint: { color: '#94A3B8', fontSize: 11, lineHeight: 17, textAlign: 'right' },
  submit: { minHeight: 52, borderRadius: 0, backgroundColor: 'transparent', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  submitText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },
});
