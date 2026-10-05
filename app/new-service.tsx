import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  Camera,
  ImagePlus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Phone,
  Clock3,
} from 'lucide-react-native';
import ScreenHeader from '@/components/shared/ScreenHeader';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { getPermanentMyLocation, savePermanentMyLocation, isAllKingdom } from '@/lib/locationSync';
import {
  LISTING_TYPES,
  DELIVERY_MODES,
  ListingTypeId,
  DeliveryModeId,
  formatServicePrice,
} from '@/lib/serviceTypes';
import {
  LocalServiceImage,
  MAX_SERVICE_IMAGES,
  pickServiceImages,
  uploadServiceImages,
} from '@/lib/serviceUpload';

type PriceType = 'fixed' | 'range' | 'negotiable';
const STEPS = ['نوع النشاط', 'الصور والتفاصيل', 'السعر والتواصل'];
const NEW_COLUMNS = ['listing_type', 'subcategory', 'images', 'cover_url', 'delivery_modes', 'details', 'shop_name', 'working_hours', 'whatsapp', 'price_type', 'price_to'];

export default function NewService() {
  const [step, setStep] = useState(0);
  const [authChecking, setAuthChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  const [typeId, setTypeId] = useState<ListingTypeId | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [images, setImages] = useState<LocalServiceImage[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopName, setShopName] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});

  const [priceType, setPriceType] = useState<PriceType>('fixed');
  const [price, setPrice] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [modes, setModes] = useState<DeliveryModeId[]>([]);
  const [workingHours, setWorkingHours] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [available, setAvailable] = useState(true);

  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);

  const type = useMemo(() => LISTING_TYPES.find((t) => t.id === typeId) || null, [typeId]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setAuthChecking(false);
        router.replace('/auth');
        return;
      }
      const loc = await getPermanentMyLocation();
      if (loc?.city && !isAllKingdom(loc.city)) {
        if (loc.region) setRegion(loc.region);
        setCity(loc.city);
        if (loc.district && loc.district !== 'كل الأحياء' && loc.district !== 'كل أحياء المدينة') setDistrict(loc.district);
      }
      const { data: p } = await supabase.from('profiles').select('region, city, district').eq('id', authData.user.id).maybeSingle();
      if (p?.region) setRegion(p.region);
      if (p?.city) {
        setCity(p.city);
        if (p?.district) setDistrict(p.district);
      }
      setAuthChecking(false);
    })();
  }, []);

  function chooseType(id: ListingTypeId) {
    if (id !== typeId) {
      const t = LISTING_TYPES.find((x) => x.id === id)!;
      setTypeId(id);
      setSubcategory('');
      setExtra({});
      setModes(t.defaultModes);
    }
    setStep(1);
  }

  async function addImages(fromCamera: boolean) {
    try {
      const picked = await pickServiceImages(MAX_SERVICE_IMAGES - images.length, fromCamera);
      if (picked.length) setImages((prev) => [...prev, ...picked].slice(0, MAX_SERVICE_IMAGES));
    } catch (e: any) {
      Alert.alert('الصور', e.message || 'تعذر اختيار الصور');
    }
  }

  function makeCover(index: number) {
    setImages((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  function toggleMode(id: DeliveryModeId) {
    setModes((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  const validPrice = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());

  function validateStep(s: number): string | null {
    if (s === 0 && !type) return 'اختر نوع نشاطك أولاً.';
    if (s === 1) {
      if (!name.trim()) return 'اكتب عنوان العرض.';
      if (!description.trim()) return 'اكتب تفاصيل العرض.';
      if (type?.showShopName && !shopName.trim()) return 'اكتب اسم المحل.';
    }
    if (s === 2) {
      if (priceType !== 'negotiable' && !validPrice(price)) return 'اكتب سعراً صحيحاً مثل 50 أو 75.50.';
      if (priceType === 'range' && (!validPrice(priceTo) || Number(priceTo) < Number(price))) return 'السعر "إلى" يجب أن يكون أكبر من "من".';
      if (!modes.length) return 'اختر طريقة تقديم واحدة على الأقل.';
      if (whatsapp.trim() && !/^(\+?966|0)?5\d{8}$/.test(whatsapp.replace(/\s/g, ''))) return 'رقم الواتساب غير صحيح (مثال: 05xxxxxxxx).';
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) return Alert.alert('تنبيه', err);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    if (step === 0) return router.canGoBack() ? router.back() : router.replace('/market');
    setStep((s) => s - 1);
  }

  async function save() {
    for (const s of [0, 1, 2]) {
      const err = validateStep(s);
      if (err) { setStep(s); return Alert.alert('تنبيه', err); }
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setBusy(false); return router.replace('/auth'); }
      const providerId = u.user.id;

      const imageUrls = images.length ? await uploadServiceImages(providerId, images) : [];

      const details: Record<string, string> = {};
      Object.entries(extra).forEach(([k, v]) => { if (v && v.trim()) details[k] = v.trim(); });

      const payload: Record<string, any> = {
        provider_id: providerId,
        name: name.trim(),
        description: description.trim(),
        category: subcategory || type!.label,
        city: city.trim() || null,
        district: district.trim() || null,
        price_from: priceType === 'negotiable' ? null : Number(price),
        price_to: priceType === 'range' ? Number(priceTo) : null,
        price_type: priceType,
        available_now: available,
        listing_type: type!.id,
        subcategory: subcategory || null,
        images: imageUrls,
        cover_url: imageUrls[0] || null,
        delivery_modes: modes,
        details,
        shop_name: shopName.trim() || null,
        working_hours: workingHours.trim() || null,
        whatsapp: whatsapp.replace(/\s/g, '') || null,
      };

      // Insert, dropping any column the live schema doesn't have yet (one at a time),
      // so a single missing column never blocks publishing.
      const attempt = { ...payload };
      let result = await supabase.from('services').insert(attempt).select('id').single();
      for (let i = 0; i < Object.keys(payload).length && result.error; i++) {
        const missing = result.error.message.match(/Could not find the '([^']+)' column/i)?.[1];
        if (missing && missing in attempt && missing !== 'provider_id' && missing !== 'name') {
          console.warn(`services.${missing} missing in schema, retrying without it`);
          delete attempt[missing];
        } else if (/column|schema cache/i.test(result.error.message) && NEW_COLUMNS.some((c) => c in attempt)) {
          console.warn('services v2 columns missing, falling back to legacy insert:', result.error.message);
          NEW_COLUMNS.forEach((c) => delete attempt[c]);
        } else {
          break;
        }
        result = await supabase.from('services').insert(attempt).select('id').single();
      }

      setBusy(false);
      if (result.error) {
        console.error('services insert failed:', result.error);
        Alert.alert('تعذر نشر العرض', result.error.message);
      } else {
        Alert.alert('تم بنجاح! 🎉', 'تم نشر عرضك في سوق الحي.');
        router.replace({ pathname: '/service', params: { id: result.data.id } });
      }
    } catch (e: any) {
      setBusy(false);
      console.error('new service save error:', e);
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء حفظ العرض.');
    }
  }

  if (authChecking) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>نجهز صفحة إضافة العرض…</Text>
      </View>
    );
  }

  const previewPrice = formatServicePrice({
    price_type: priceType,
    price_from: price && validPrice(price) ? Number(price) : null,
    price_to: priceTo && validPrice(priceTo) ? Number(priceTo) : null,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScreenHeader title="أضف عرضك في السوق" fallbackRoute="/market" />
        <View style={styles.stepper}>
          {STEPS.map((label, i) => (
            <Pressable
              key={label}
              style={styles.stepItem}
              onPress={() => { if (i < step) setStep(i); }}
            >
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                {i < step ? <Check size={12} color="#fff" /> : <Text style={[styles.stepNum, i <= step && { color: '#fff' }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]} numberOfLines={1}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} /></View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>وش نوع نشاطك؟</Text>
            <Text style={styles.stepHint}>اختر الأقرب لك، ونجهز لك الحقول المناسبة.</Text>
            <View style={styles.typeGrid}>
              {LISTING_TYPES.map((t) => {
                const active = t.id === typeId;
                return (
                  <Pressable
                    key={t.id}
                    id={`type-${t.id}`}
                    style={({ pressed }) => [styles.typeCard, active && { borderColor: t.color, backgroundColor: t.bg }, pressed && { transform: [{ scale: 0.97 }] }]}
                    onPress={() => chooseType(t.id)}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: t.bg }]}><t.Icon size={22} color={t.color} /></View>
                    <Text style={styles.typeLabel}>{t.label}</Text>
                    <Text style={styles.typeHint} numberOfLines={2}>{t.hint}</Text>
                    {active && <View style={[styles.typeCheck, { backgroundColor: t.color }]}><Check size={11} color="#fff" /></View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 1 && type && (
          <View>
            <View style={[styles.typeBanner, { backgroundColor: type.bg }]}>
              <type.Icon size={18} color={type.color} />
              <Text style={[styles.typeBannerText, { color: type.color }]}>{type.label}</Text>
              <Pressable onPress={() => setStep(0)}><Text style={styles.changeLink}>تغيير</Text></Pressable>
            </View>

            <Section title={`الصور (${images.length}/${MAX_SERVICE_IMAGES})`} hint="أول صورة هي الغلاف. الصور الواضحة تضاعف التواصل.">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                {images.length < MAX_SERVICE_IMAGES && (
                  <View style={styles.addImageCol}>
                    <Pressable id="add-images-gallery" style={styles.addImageBtn} onPress={() => addImages(false)}>
                      <ImagePlus size={22} color="#059669" />
                      <Text style={styles.addImageText}>من المعرض</Text>
                    </Pressable>
                    {Platform.OS !== 'web' && (
                      <Pressable style={styles.cameraBtn} onPress={() => addImages(true)}>
                        <Camera size={14} color="#047857" />
                        <Text style={styles.cameraText}>كاميرا</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                {images.map((img, i) => (
                  <View key={img.uri + i} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Pressable style={styles.thumbRemove} onPress={() => setImages((p) => p.filter((_, x) => x !== i))}>
                      <X size={12} color="#fff" />
                    </Pressable>
                    {i === 0 ? (
                      <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>الغلاف</Text></View>
                    ) : (
                      <Pressable style={styles.makeCoverBtn} onPress={() => makeCover(i)}>
                        <Star size={10} color="#fff" />
                        <Text style={styles.coverBadgeText}>غلاف</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
            </Section>

            <Section title="التصنيف">
              <View style={styles.chipsWrap}>
                {type.subcategories.map((c) => (
                  <Chip key={c} label={c} active={subcategory === c} color={type.color} onPress={() => setSubcategory(subcategory === c ? '' : c)} />
                ))}
              </View>
            </Section>

            <Section title="عنوان العرض *">
              <Field value={name} onChangeText={setName} placeholder={type.titlePlaceholder} maxLength={80} />
              <Text style={styles.counter}>{name.trim().length}/80</Text>
            </Section>

            {type.showShopName && (
              <Section title="اسم المحل *">
                <Field value={shopName} onChangeText={setShopName} placeholder="مثال: بقالة النخيل" maxLength={60} />
              </Section>
            )}

            {type.extraFields.map((f) => (
              <Section key={f.key} title={f.label}>
                {f.kind === 'choice' ? (
                  <View style={styles.chipsWrap}>
                    {f.options!.map((o) => (
                      <Chip key={o} label={o} active={extra[f.key] === o} color={type.color}
                        onPress={() => setExtra((p) => ({ ...p, [f.key]: p[f.key] === o ? '' : o }))} />
                    ))}
                  </View>
                ) : (
                  <Field value={extra[f.key] || ''} onChangeText={(v) => setExtra((p) => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} maxLength={200} />
                )}
              </Section>
            ))}

            <Section title="التفاصيل *">
              <Field
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح ما تقدمه، المكونات أو المواصفات، وأي شروط..."
                maxLength={800}
                multiline
              />
              <Text style={styles.counter}>{description.trim().length}/800</Text>
            </Section>
          </View>
        )}

        {step === 2 && type && (
          <View>
            <Section title="السعر">
              <View style={styles.segment}>
                {([['fixed', 'سعر ثابت'], ['range', 'من - إلى'], ['negotiable', 'حسب الاتفاق']] as [PriceType, string][]).map(([id, label]) => (
                  <Pressable key={id} style={[styles.segmentItem, priceType === id && styles.segmentItemActive]} onPress={() => setPriceType(id)}>
                    <Text style={[styles.segmentText, priceType === id && styles.segmentTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {priceType !== 'negotiable' && (
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Field value={price} onChangeText={setPrice} placeholder={priceType === 'range' ? 'من' : 'السعر'} keyboardType="numeric" maxLength={8} suffix="ر.س" />
                  </View>
                  {priceType === 'range' && (
                    <View style={{ flex: 1 }}>
                      <Field value={priceTo} onChangeText={setPriceTo} placeholder="إلى" keyboardType="numeric" maxLength={8} suffix="ر.س" />
                    </View>
                  )}
                </View>
              )}
            </Section>

            <Section title="طريقة التقديم *" hint="اختر كل ما ينطبق">
              <View style={styles.chipsWrap}>
                {DELIVERY_MODES.map((m) => (
                  <Chip key={m.id} label={`${m.emoji}  ${m.label}`} active={modes.includes(m.id)} color="#059669" onPress={() => toggleMode(m.id)} />
                ))}
              </View>
            </Section>

            <Section title={type.nationwide ? 'موقعك (الخدمة تظهر لكل المملكة)' : 'الموقع والحي'}>
              <Pressable style={styles.locationBtn} onPress={() => setShowLocationModal(true)}>
                <MapPin size={18} color="#059669" />
                <Text style={styles.locationBtnText}>{city ? `${city}${district ? ` · حي ${district}` : ''}` : 'اختر مدينتك وحيك...'}</Text>
                <ChevronLeft size={16} color="#94a3b8" />
              </Pressable>
            </Section>

            <Section title="أوقات العمل (اختياري)">
              <Field value={workingHours} onChangeText={setWorkingHours} placeholder="مثال: يومياً 4م - 11م" maxLength={60} icon={<Clock3 size={16} color="#94a3b8" />} />
            </Section>

            <Section title="رقم واتساب (اختياري)" hint="يظهر زر واتساب في صفحة عرضك. التواصل داخل التطبيق متاح دائماً.">
              <Field value={whatsapp} onChangeText={setWhatsapp} placeholder="05xxxxxxxx" keyboardType="phone-pad" maxLength={14} icon={<Phone size={16} color="#94a3b8" />} />
            </Section>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>متاح الآن</Text>
                <Text style={styles.switchSub}>يظهر وسم "متاح" على بطاقتك</Text>
              </View>
              <Switch value={available} onValueChange={setAvailable} trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }} thumbColor={available ? '#059669' : '#9ca3af'} />
            </View>

            <Text style={styles.previewTitle}>معاينة البطاقة</Text>
            <View style={styles.previewCard}>
              <View style={[styles.previewImage, { backgroundColor: type.bg }]}>
                {images[0] ? <Image source={{ uri: images[0].uri }} style={StyleSheet.absoluteFillObject} /> : <type.Icon size={34} color={type.color} />}
                <View style={styles.previewTypeBadge}><Text style={[styles.previewTypeText, { color: type.color }]}>{type.short}</Text></View>
              </View>
              <View style={{ padding: 12 }}>
                <Text style={styles.previewName} numberOfLines={1}>{name || 'عنوان العرض'}</Text>
                <Text style={styles.previewPrice}>{previewPrice}</Text>
                <Text style={styles.previewModes}>{modes.map((m) => DELIVERY_MODES.find((d) => d.id === m)?.emoji).join(' ')}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.backBtn} onPress={back}>
          <ChevronRight size={18} color="#334155" />
          <Text style={styles.backBtnText}>{step === 0 ? 'إلغاء' : 'رجوع'}</Text>
        </Pressable>
        {step > 0 && (
          step < STEPS.length - 1 ? (
            <Pressable id="wizard-next" style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>التالي</Text>
              <ChevronLeft size={18} color="#fff" />
            </Pressable>
          ) : (
            <Pressable id="publish-service" style={[styles.nextBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.nextBtnText}>نشر العرض ✨</Text>}
            </Pressable>
          )
        )}
      </View>

      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city}
        selectedDistrict={district}
        onSelect={async (reg, c, d) => {
          const cleanCity = c === 'كل المدن' ? '' : c;
          const cleanDist = (d === 'كل أحياء المدينة' || d === 'كل الأحياء') ? '' : d;
          setRegion(reg || '');
          setCity(cleanCity);
          setDistrict(cleanDist);
          if (cleanCity) {
            await savePermanentMyLocation({ region: reg, city: cleanCity, district: cleanDist || 'كل الأحياء' });
            const { data: u } = await supabase.auth.getUser();
            if (u.user) {
              await supabase.from('profiles').update({ region: reg || region || null, city: cleanCity, district: cleanDist || 'كل الأحياء' }).eq('id', u.user.id);
            }
          }
        }}
      />
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ multiline, suffix, icon, ...props }: React.ComponentProps<typeof TextInput> & { suffix?: string; icon?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, multiline && { minHeight: 120, alignItems: 'flex-start' }, focused && styles.fieldFocused]}>
      {icon}
      <TextInput
        {...props}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="#9ca3af"
        textAlign="right"
        style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', gap: 12 },
  loadingText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#065f46',
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  stepper: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 6, gap: 6 },
  stepItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#10b981' },
  stepNum: { color: '#a7f3d0', fontSize: 11, fontWeight: '900' },
  stepLabel: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  stepLabelActive: { color: '#fff', fontWeight: '900' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 12, overflow: 'hidden', flexDirection: 'row-reverse' },
  progressFill: { height: 4, backgroundColor: '#34d399', borderRadius: 2 },
  scroll: { padding: 16, paddingBottom: 120, width: '100%', maxWidth: 720, alignSelf: 'center' },

  stepTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  stepHint: { fontSize: 13, color: '#64748b', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  typeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  typeCard: {
    width: '48.5%', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: '#eef2f7',
    alignItems: 'flex-end', minHeight: 128, position: 'relative',
  },
  typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeLabel: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  typeHint: { fontSize: 11.5, color: '#64748b', textAlign: 'right', marginTop: 4, lineHeight: 17 },
  typeCheck: { position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  typeBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 14 },
  typeBannerText: { flex: 1, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  changeLink: { color: '#475569', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },

  section: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#1e293b', textAlign: 'right' },
  sectionHint: { fontSize: 11.5, color: '#94a3b8', textAlign: 'right', marginTop: 3 },

  imagesRow: { flexDirection: 'row-reverse', gap: 10 },
  addImageCol: { gap: 6 },
  addImageBtn: { width: 96, height: 96, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6ee7b7', backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addImageText: { fontSize: 11, color: '#047857', fontWeight: '800' },
  cameraBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, borderRadius: 10, backgroundColor: '#ecfdf5' },
  cameraText: { fontSize: 11, color: '#047857', fontWeight: '800' },
  thumbWrap: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,23,42,0.65)', alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  makeCoverBtn: { position: 'absolute', bottom: 6, right: 6, flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  chipText: { fontSize: 12.5, color: '#475569', fontWeight: '700' },

  field: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  fieldFocused: { borderColor: '#10b981', backgroundColor: '#fff' },
  input: { flex: 1, color: '#0f172a', fontSize: 14, padding: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  suffix: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  counter: { color: '#cbd5e1', fontSize: 10.5, fontWeight: '700', textAlign: 'left', marginTop: 5 },

  segment: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 3, marginBottom: 10 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentItemActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 12.5, color: '#64748b', fontWeight: '700' },
  segmentTextActive: { color: '#047857', fontWeight: '900' },
  priceRow: { flexDirection: 'row-reverse', gap: 10 },

  locationBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: '#e2e8f0' },
  locationBtnText: { flex: 1, color: '#0f172a', fontSize: 13.5, fontWeight: '700', textAlign: 'right' },

  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#f1f5f9' },
  switchTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  switchSub: { color: '#64748b', fontSize: 11.5, textAlign: 'right', marginTop: 2 },

  previewTitle: { fontSize: 13, fontWeight: '900', color: '#64748b', textAlign: 'right', marginBottom: 8 },
  previewCard: { width: 180, alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7' },
  previewImage: { height: 130, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewTypeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  previewTypeText: { fontSize: 10, fontWeight: '900' },
  previewName: { fontSize: 13.5, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  previewPrice: { fontSize: 13, fontWeight: '900', color: '#059669', textAlign: 'right', marginTop: 4 },
  previewModes: { fontSize: 12, textAlign: 'right', marginTop: 4 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row-reverse', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#eef2f7',
  },
  backBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9' },
  backBtnText: { color: '#334155', fontSize: 14, fontWeight: '800' },
  nextBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: '#059669' },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
