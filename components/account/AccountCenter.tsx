import { OasisArtwork } from '@/components/oasis/OasisPrimitives';
import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Platform, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Bell,
  BellOff,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronLeft,
  CircleUserRound,
  Eye,
  Heart,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  UserRound,
  UserX,
  Users,
  Wrench,
} from 'lucide-react-native';

import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  AccountIdentityBadge,
  AccountIdentityIcon,
  AccountVerificationBadge,
  getAccountIdentityMeta,
  type AccountKind,
} from '@/components/profile/AccountIdentityBadge';
import { supabase } from '@/lib/supabase';
import { ProfileDesignStudio, type FeaturedType, type StudioItem, type FeaturedRow } from '@/components/profile/ProfileDesignStudio';
import { bannerColors, DEFAULT_FEATURED_TITLE, DEFAULT_SECTION_VISIBILITY, DEFAULT_SECTION_ORDER, DEFAULT_PROFILE_TYPE, MAX_FEATURED } from '@/lib/profileTheme';
import { profileCoverUrl, uploadProfileCover, removeProfileCover } from '@/lib/profileCover';
import { useBottomNavInset } from '@/lib/bottomNav';
import { registerPushToken, syncDndWithNotifications, unregisterPushToken } from '@/lib/notifications';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation } from '@/lib/locationSync';
import {
  DEFAULT_DND,
  type DndSettings,
  displayName as blockedDisplayName,
  loadBlockedUsers,
  loadDnd,
  saveDnd,
  setBlock,
} from '@/lib/chatControls';

type HubTab = 'profile' | 'content' | 'settings';
type ContentFilter = 'all' | 'products' | 'services' | 'community';
type Capability = {
  user_id?: string;
  role?: string;
  account_type?: AccountKind;
  is_verified?: boolean;
  is_verified_merchant?: boolean;
  can_sell_personal?: boolean;
  can_publish_products?: boolean;
  can_publish_services?: boolean;
  can_manage_business?: boolean;
  can_promote?: boolean;
  professional_name?: string | null;
};

const ACCOUNT_TYPES: { key: AccountKind; label: string; description: string }[] = [
  { key: 'standard', label: 'فردي', description: 'مشاركة المجتمع والبيع الشخصي' },
  { key: 'merchant', label: 'تجاري', description: 'منشأة ومنتجات وخدمات' },
  { key: 'freelance', label: 'عمل حر', description: 'خدمات مهنية باسمك' },
  { key: 'provider', label: 'مقدم خدمة', description: 'خدمات محلية لسكان الحي' },
  { key: 'idea', label: 'مبادرة', description: 'مشروع أو مبادرة مجتمعية' },
];



function normalizeTab(value?: string): HubTab {
  if (value === 'content' || value === 'business' || value === 'commerce') return 'content';
  if (value === 'settings' || value === 'privacy' || value === 'security' || value === 'design') return 'settings';
  return 'profile';
}

function accountTypeLabel(value?: string | null) {
  return ACCOUNT_TYPES.find((item) => item.key === value)?.label || 'فردي';
}

function statusLabel(value?: string | null) {
  switch ((value || '').toLowerCase()) {
    case 'approved': return 'معتمد';
    case 'rejected': return 'مرفوض';
    case 'sold': return 'تم البيع';
    case 'reserved': return 'محجوز';
    case 'pending': return 'قيد المراجعة';
    case 'available': return 'متاح';
    default: return value || 'نشط';
  }
}

export default function AccountCenter() {
  const params = useLocalSearchParams<{ tab?: string; section?: string }>();
  const bottomInset = useBottomNavInset();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const scrollRef = useRef<ScrollView>(null);
  const designY = useRef(0);
  const designScrolled = useRef(false);
  const requestedTab = normalizeTab(Array.isArray(params.tab) ? params.tab[0] : params.tab);
  const [tab, setTab] = useState<HubTab>(requestedTab);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<Capability>({});
  const [stats, setStats] = useState({ followers: 0, following: 0, reputation: 0, community: 0 });

  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [business, setBusiness] = useState<any | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  const [verification, setVerification] = useState<any | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityType, setIdentityType] = useState<AccountKind>('standard');
  const [professionalName, setProfessionalName] = useState('');
  const [evidence, setEvidence] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);

  const [customization, setCustomization] = useState<any>({
    accent_color: OASIS.colors.primary,
    banner_style: 'emerald',
    show_stats: true,
    show_badges: true,
    featured_title: DEFAULT_FEATURED_TITLE,
    section_visibility: DEFAULT_SECTION_VISIBILITY,
    section_order: DEFAULT_SECTION_ORDER,
    profile_type: DEFAULT_PROFILE_TYPE,
  });
  const [featured, setFeatured] = useState<FeaturedRow[]>([]);
  const [coverVersion, setCoverVersion] = useState<number | null>(null);
  const [coverState, setCoverState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [coverBusy, setCoverBusy] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [dnd, setDnd] = useState<DndSettings>(DEFAULT_DND);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('07:00');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    setTab(requestedTab);
    const section = Array.isArray(params.section) ? params.section[0] : params.section;
    if (section === 'identity') setIdentityOpen(true);
  }, [requestedTab, params.section]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setCoverState('loading');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        router.replace('/auth');
        return;
      }

      const uid = auth.user.id;
      setUserId(uid);
      setEmail(auth.user.email || '');
      setEmailDraft(auth.user.email || '');

      const [
        profileRes,
        capabilityRes,
        productRes,
        serviceRes,
        questionRes,
        requestRes,
        businessRes,
        verificationRes,
        customizationRes,
        followersRes,
        followingRes,
        reputationRes,
        pushRes,
        featuredRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.rpc('hayna_my_account_capabilities'),
        supabase.from('marketplace_items').select('id,title,description,price,item_type,status,image_url,created_at,business_id').eq('seller_id', uid).order('created_at', { ascending: false }).limit(40),
        supabase.from('services').select('id,name,description,price_from,price_to,price_type,cover_url,activity_status,moderation_status,created_at,business_id').eq('provider_id', uid).order('created_at', { ascending: false }).limit(40),
        supabase.from('questions').select('id,title,body,created_at,status').eq('author_id', uid).order('created_at', { ascending: false }).limit(20),
        supabase.from('requests').select('id,title,description,created_at,status').eq('requester_id', uid).order('created_at', { ascending: false }).limit(20),
        supabase.from('businesses').select('*').eq('owner_id', uid).maybeSingle(),
        supabase.from('verification_requests').select('id,status,subject,note,created_at,reviewed_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profile_customizations').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        supabase.from('reputation').select('points').eq('user_id', uid).maybeSingle(),
        supabase.from('push_tokens').select('id').eq('user_id', uid).eq('platform', Platform.OS).limit(1),
        supabase.from('profile_featured_items').select('item_type,item_id,position').eq('user_id', uid).order('position', { ascending: true }),
      ]);

      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data;
      if (!p) throw new Error('تعذر العثور على ملف الحساب.');

      setProfile(p);
      setDisplayName(p.display_name || '');
      setUsername(p.username || '');
      setBio(p.bio || '');
      setIdentityType((p.account_type || 'standard') as AccountKind);
      setProfessionalName(p.freelance_trade || '');
      setCapabilities((capabilityRes.data || {}) as Capability);
      setProducts(productRes.data || []);
      setServices(serviceRes.data || []);
      setQuestions(questionRes.data || []);
      setRequests(requestRes.data || []);
      setBusiness(businessRes.data || null);
      setVerification(verificationRes.data || null);
      setCustomization(customizationRes.data || {
        accent_color: OASIS.colors.primary,
        banner_style: 'emerald',
        show_stats: true,
        show_badges: true,
        featured_title: DEFAULT_FEATURED_TITLE,
        section_visibility: DEFAULT_SECTION_VISIBILITY,
        section_order: DEFAULT_SECTION_ORDER,
        profile_type: DEFAULT_PROFILE_TYPE,
      });
      setFeatured((featuredRes.data || []) as FeaturedRow[]);
      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        reputation: reputationRes.data?.points || 0,
        community: (questionRes.data?.length || 0) + (requestRes.data?.length || 0),
      });
      setPushEnabled(Boolean(pushRes.data?.length));

      try {
        const nextDnd = await loadDnd(uid);
        setDnd(nextDnd);
        setDndStart(nextDnd.start || '22:00');
        setDndEnd(nextDnd.end || '07:00');
      } catch {}

      try {
        const blocked = await loadBlockedUsers(uid);
        setBlockedUsers((blocked || []).filter(Boolean));
      } catch {}
    } catch (error: any) {
      Alert.alert('تعذر تحميل الحساب', error?.message || 'حاول مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionParam = Array.isArray(params.section) ? params.section[0] : params.section;
  useEffect(() => {
    if (sectionParam === 'design' && !designScrolled.current) {
      const id = setTimeout(() => {
        if (designY.current) {
          scrollRef.current?.scrollTo({ y: Math.max(0, designY.current - 10), animated: true });
          designScrolled.current = true;
        }
      }, 400);
      return () => clearTimeout(id);
    }
  }, [sectionParam, loading]);

  const identityMeta = useMemo(
    () => getAccountIdentityMeta(profile?.role, profile?.account_type, Boolean(profile?.is_verified)),
    [profile?.role, profile?.account_type, profile?.is_verified],
  );

  const publicName = profile?.account_type === 'merchant' && profile?.freelance_trade
    ? profile.freelance_trade
    : profile?.display_name || profile?.username || 'حساب حيّنا';

  const verificationPending = (verification?.status || '').toLowerCase() === 'pending';
  const totalOwned = products.length + services.length + questions.length + requests.length;
  const IdentityMetaIcon = identityMeta.Icon;

  async function saveProfile() {
    if (!userId || !displayName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
      }).eq('id', userId);
      if (error) throw error;

      const nextUsername = username.trim().toLowerCase();
      if (nextUsername && nextUsername !== String(profile?.username || '').toLowerCase()) {
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(nextUsername)) {
          throw new Error('اسم المستخدم يجب أن يكون 3-30 حرفًا إنجليزيًا أو رقمًا أو شرطة سفلية.');
        }
        const changed = await supabase.rpc('change_my_username', { p_username: nextUsername });
        if (changed.error) throw changed.error;
      }

      setEditing(false);
      await load(true);
    } catch (error: any) {
      Alert.alert('تعذر حفظ الملف', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  async function pickAvatar() {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.78,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const asset = result.assets[0];
      const body = await (await fetch(asset.uri)).arrayBuffer();
      const path = userId + '/avatar.jpg';
      const upload = await supabase.storage.from('avatars').upload(path, body, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: true,
      });
      if (upload.error) throw upload.error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const saved = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (saved.error) throw saved.error;
      setProfile((current: any) => ({ ...(current || {}), avatar_url: url }));
    } catch (error: any) {
      Alert.alert('تعذر تحديث الصورة', error?.message || 'حاول مرة أخرى.');
    }
  }

  async function pickCover() {
    if (!userId || coverBusy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setCoverBusy(true);
    try {
      const asset = result.assets[0];
      await uploadProfileCover(userId, asset);
      setCoverVersion(Date.now());
      setCoverState('ready');
      Alert.alert('تم حفظ الغلاف', 'ستظهر الصورة كخلفية لملفك العام.');
    } catch (error: any) {
      Alert.alert('تعذر حفظ الغلاف', error?.message || 'حاول مرة أخرى.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function removeCover() {
    if (!userId || coverBusy) return;
    setCoverBusy(true);
    try {
      await removeProfileCover(userId);
      setCoverVersion(null);
      setCoverState('missing');
    } catch (error: any) {
      Alert.alert('تعذر إزالة الغلاف', error?.message || 'حاول مرة أخرى.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function toggleFeatured(type: FeaturedType, id: string) {
    if (!userId) return;
    const exists = featured.some((row) => row.item_type === type && row.item_id === id);
    if (!exists && featured.length >= MAX_FEATURED) {
      Alert.alert('الحد الأقصى', `يمكن تثبيت حتى ${MAX_FEATURED} عناصر.`);
      return;
    }
    try {
      if (exists) {
        const { error } = await supabase.from('profile_featured_items').delete().match({ user_id: userId, item_type: type, item_id: id });
        if (error) throw error;
        setFeatured((current) => current.filter((row) => !(row.item_type === type && row.item_id === id)));
      } else {
        const { data, error } = await supabase.from('profile_featured_items').insert({
          user_id: userId,
          item_type: type,
          item_id: id,
          position: featured.length,
        }).select().maybeSingle();
        if (error) throw error;
        setFeatured((current) => [...current, (data as FeaturedRow) || { item_type: type, item_id: id, position: current.length }]);
      }
    } catch (error: any) {
      Alert.alert('تعذر تحديث الأعمال المميزة', error?.message || 'حاول مرة أخرى.');
    }
  }

  async function resetDesign() {
    await saveCustomization({
      accent_color: OASIS.colors.primary,
      banner_style: 'emerald',
      show_stats: true,
      show_badges: true,
      featured_title: DEFAULT_FEATURED_TITLE,
      section_visibility: DEFAULT_SECTION_VISIBILITY,
      section_order: DEFAULT_SECTION_ORDER,
      profile_type: DEFAULT_PROFILE_TYPE,
    });
  }
  async function updateCurrentLocation() {
    if (!userId || locationBusy) return;
    setLocationBusy(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) throw new Error('اسمح للتطبيق باستخدام الموقع أثناء الاستخدام.');
      const place = await reverseGeocodeDeviceLocation(location);
      if (!place?.region || !place?.city || !place?.district) throw new Error('تعذر تحديد المنطقة والمدينة والحي بدقة.');
      const next = { region: place.region, city: place.city, district: place.district };
      const updated = await supabase.from('profiles').update(next).eq('id', userId);
      if (updated.error) throw updated.error;
      await savePermanentMyLocation(next, true, { allowCityChange: true });
      setProfile((current: any) => ({ ...(current || {}), ...next }));
    } catch (error: any) {
      Alert.alert('تعذر تحديث الموقع', error?.message || 'حاول مرة أخرى.');
    } finally {
      setLocationBusy(false);
    }
  }

  async function chooseEvidence() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) setEvidence(result.assets[0]);
  }

  async function submitIdentityRequest() {
    if (!userId || identitySaving) return;
    if (verificationPending) {
      Alert.alert('طلب قيد المراجعة', 'لا يمكن إرسال طلب جديد قبل أن تراجع الإدارة الطلب الحالي.');
      return;
    }
    const isProfessional = identityType !== 'standard';
    const needsEvidence = isProfessional || !Boolean(profile?.is_verified);
    if (isProfessional && !professionalName.trim()) {
      Alert.alert('بيانات ناقصة', identityType === 'merchant' ? 'اكتب اسم المنشأة أو النشاط التجاري.' : 'اكتب اسم المجال أو النشاط المهني.');
      return;
    }
    if (needsEvidence && !evidence) {
      Alert.alert('الإثبات مطلوب', identityType === 'standard'
        ? 'أرفق إثبات هوية حتى تتمكن الإدارة من توثيق الحساب الفردي.'
        : 'أرفق مستندًا مناسبًا حتى تتمكن الإدارة من التحقق من الصفة.');
      return;
    }

    setIdentitySaving(true);
    let uploadedPath: string | null = null;
    try {
      if (evidence) {
        const body = await (await fetch(evidence.uri)).arrayBuffer();
        const ext = (evidence.mimeType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        uploadedPath = userId + '/' + Date.now() + '-verification.' + ext;
        const upload = await supabase.storage.from('verification-documents').upload(uploadedPath, body, {
          contentType: evidence.mimeType || 'image/jpeg',
          upsert: false,
        });
        if (upload.error) throw upload.error;
      }

      const verificationType = identityType === 'standard'
        ? 'identity'
        : identityType === 'freelance'
          ? 'freelance'
          : 'business';

      const inserted = await supabase.from('verification_requests').insert({
        user_id: userId,
        status: 'pending',
        subject: identityType,
        verification_type: verificationType,
        note: professionalName.trim() || displayName.trim() || 'طلب توثيق الحساب',
        attachment_url: uploadedPath,
        document_url: null,
      });
      if (inserted.error) throw inserted.error;
      setEvidence(null);
      setIdentityOpen(false);
      await load(true);
      Alert.alert('تم إرسال الطلب', 'ستبقى الصفة الحالية كما هي حتى تراجع الإدارة الطلب وتوافق عليه.');
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from('verification-documents').remove([uploadedPath]);
      Alert.alert('تعذر إرسال الطلب', error?.message || 'حاول مرة أخرى.');
    } finally {
      setIdentitySaving(false);
    }
  }

  async function savePrivacy(patch: Record<string, any>) {
    if (!userId) return;
    setSettingsSaving(true);
    try {
      const updated = await supabase.from('profiles').update(patch).eq('id', userId);
      if (updated.error) throw updated.error;
      setProfile((current: any) => ({ ...(current || {}), ...patch }));
    } catch (error: any) {
      Alert.alert('تعذر حفظ الإعداد', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unregisterPushToken();
        setPushEnabled(false);
      } else {
        const token = await registerPushToken();
        if (!token) throw new Error('لم يتم منح إذن الإشعارات أو أن الجهاز لا يدعمها.');
        setPushEnabled(true);
      }
    } catch (error: any) {
      Alert.alert('الإشعارات', error?.message || 'تعذر تحديث الإشعارات.');
    } finally {
      setPushBusy(false);
    }
  }

  async function saveDndSettings(enabled: boolean, start = dndStart, end = dndEnd) {
    if (!userId) return;
    const next: DndSettings = { ...dnd, enabled, schedule: enabled ? 'custom' : 'off', start, end };
    const result = await saveDnd(userId, next);
    if (!result.ok) {
      Alert.alert('تعذر الحفظ', result.error);
      return;
    }
    setDnd(next);
    await syncDndWithNotifications(userId);
  }

  async function saveCustomization(patch: Record<string, any>) {
    if (!userId) return;
    const next = { ...customization, ...patch };
    setCustomization(next);
    const saved = await supabase.from('profile_customizations').upsert({
      user_id: userId,
      accent_color: next.accent_color || OASIS.colors.primary,
      banner_style: next.banner_style || 'emerald',
      show_stats: next.show_stats !== false,
      show_badges: next.show_badges !== false,
      featured_title: next.featured_title || DEFAULT_FEATURED_TITLE,
      section_visibility: next.section_visibility || DEFAULT_SECTION_VISIBILITY,
      section_order: next.section_order || DEFAULT_SECTION_ORDER,
      profile_type: next.profile_type || DEFAULT_PROFILE_TYPE,
    }, { onConflict: 'user_id' });
    if (saved.error) Alert.alert('تعذر حفظ المظهر', saved.error.message);
  }

  async function saveBusiness() {
    if (!business?.id || !capabilities.can_manage_business) return;
    setSaving(true);
    try {
      const result = await supabase.from('businesses').update({
        name: business.name?.trim(),
        description: business.description?.trim() || null,
        phone: business.phone?.trim() || null,
        whatsapp: business.whatsapp?.trim() || null,
      }).eq('id', business.id);
      if (result.error) throw result.error;
      Alert.alert('تم الحفظ', 'تم تحديث بيانات المنشأة.');
    } catch (error: any) {
      Alert.alert('تعذر تحديث المنشأة', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    const next = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(next)) return Alert.alert('البريد غير صالح', 'أدخل بريدًا إلكترونيًا صحيحًا.');
    setSettingsSaving(true);
    try {
      const result = await supabase.auth.updateUser({ email: next });
      if (result.error) throw result.error;
      Alert.alert('تحقق من بريدك', 'تم إرسال رسالة تأكيد إلى البريد الجديد.');
    } catch (error: any) {
      Alert.alert('تعذر تغيير البريد', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function changePassword() {
    if (passwordDraft.length < 8) return Alert.alert('كلمة المرور قصيرة', 'استخدم 8 أحرف على الأقل.');
    if (passwordDraft !== passwordConfirm) return Alert.alert('عدم تطابق', 'تأكيد كلمة المرور غير مطابق.');
    setSettingsSaving(true);
    try {
      const result = await supabase.auth.updateUser({ password: passwordDraft });
      if (result.error) throw result.error;
      setPasswordDraft('');
      setPasswordConfirm('');
      Alert.alert('تم التحديث', 'تم تغيير كلمة المرور.');
    } catch (error: any) {
      Alert.alert('تعذر تغيير كلمة المرور', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function unblockUser(targetId: string) {
    if (!userId) return;
    const result = await setBlock(userId, targetId, false);
    if (!result.ok) return Alert.alert('تعذر إلغاء الحظر', result.error);
    setBlockedUsers((current) => current.filter((item) => item.id !== targetId));
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'حذف الحساب نهائيًا',
      'سيتم حذف بيانات الحساب ولا يمكن التراجع عن هذه العملية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: () => void (async () => {
            const result = await supabase.functions.invoke('delete-account');
            if (result.error) return Alert.alert('تعذر الحذف', result.error.message);
            await supabase.auth.signOut({ scope: 'local' });
            router.replace('/auth');
          })(),
        },
      ],
    );
  }

  function openAdd(kind: 'product' | 'service') {
    if (kind === 'service' && !capabilities.can_publish_services) {
      setTab('profile');
      setIdentityType(profile?.account_type === 'standard' ? 'provider' : (profile?.account_type || 'provider'));
      setIdentityOpen(true);
      Alert.alert('يتطلب حسابًا مهنيًا', 'فعّل صفة عمل حر أو مقدم خدمة أو تجاري أولًا، ثم انتظر اعتماد الإدارة.');
      return;
    }
    router.push({ pathname: '/new-listing', params: { kind } });
  }

  function openOwnedItem(kind: string, item: any) {
    if (kind === 'product') router.push({ pathname: '/marketplace-item', params: { id: item.id } });
    else if (kind === 'service') router.push({ pathname: '/service', params: { id: item.id } });
    else if (kind === 'question') router.push({ pathname: '/question', params: { id: item.id } });
    else router.push({ pathname: '/request', params: { id: item.id } });
  }

  const filteredContent = useMemo(() => {
    const all = [
      ...products.map((item) => ({ kind: 'product', item })),
      ...services.map((item) => ({ kind: 'service', item })),
      ...questions.map((item) => ({ kind: 'question', item })),
      ...requests.map((item) => ({ kind: 'request', item })),
    ];
    if (contentFilter === 'products') return all.filter((row) => row.kind === 'product');
    if (contentFilter === 'services') return all.filter((row) => row.kind === 'service');
    if (contentFilter === 'community') return all.filter((row) => row.kind === 'question' || row.kind === 'request');
    return all.sort((a, b) => new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime());
  }, [products, services, questions, requests, contentFilter]);

  if (loading || !profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تجهيز مركز حسابك...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="tab"
        title="حسابي"
        subtitle="ملفك، أعمالك وإعداداتك في مكان واحد"
        rightAction={
          <Pressable
            style={styles.headerAction}
            onPress={() => router.push({ pathname: '/user', params: { id: userId } })}
            accessibilityRole="button"
            accessibilityLabel="عرض الملف العام"
          >
            <Eye size={18} color="#0F766E" />
          </Pressable>
        }
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={OASIS.colors.primary} />}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28, maxWidth: wide ? 1120 : 920 }]}
      >
        <View style={[styles.profileHero, wide && styles.profileHeroWide]}>
          <LinearGradient colors={bannerColors(customization?.banner_style)} style={StyleSheet.absoluteFillObject} />
          {profileCoverUrl(userId, coverVersion) && coverState !== 'missing' ? (
            <Image source={{ uri: profileCoverUrl(userId, coverVersion) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onLoad={() => setCoverState('ready')} onError={() => setCoverState('missing')} />
          ) : null}
          <LinearGradient colors={['rgba(4,10,8,0.12)', 'rgba(4,10,8,0.62)']} style={StyleSheet.absoluteFillObject} />
          <Pressable oasisKind="plain" onPress={pickAvatar} style={styles.avatarWrap}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{publicName.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}><Camera size={13} color={OASIS.colors.surface} /></View>
            <AccountIdentityIcon role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} size={30} style={styles.identityIcon} />
          </Pressable>

          <View style={styles.heroCopy}>
            <Text style={styles.publicName} numberOfLines={1}>{publicName}</Text>
            <Text style={styles.handle}>@{profile.username}</Text>
            <View style={styles.badgeRow}>
              <AccountIdentityBadge role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} compact />
              <AccountVerificationBadge role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} compact />
            </View>
            {(profile.city || profile.district) ? (
              <View style={styles.locationLine}>
                <MapPin size={13} color="rgba(255,255,255,0.82)" />
                <Text style={styles.locationText}>{[profile.district && 'حي ' + profile.district, profile.city].filter(Boolean).join(' · ')}</Text>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.heroCoverButton} onPress={() => void pickCover()} disabled={coverBusy}>
            {coverBusy ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Camera size={14} color={OASIS.colors.surface} />}
            <Text style={styles.heroCoverButtonText}>{coverState === 'ready' ? 'تغيير الغلاف' : 'غلاف'}</Text>
          </Pressable>
        </View>

        <View style={styles.statsBar}>
          <Stat value={stats.followers} label="متابع" />
          <Stat value={stats.following} label="يتابع" />
          <Stat value={totalOwned} label="محتوى" />
          <Stat value={stats.reputation} label="سمعة" />
        </View>

        <View style={styles.tabs}>
          <HubTabButton active={tab === 'profile'} label="الملف" Icon={CircleUserRound} onPress={() => setTab('profile')} />
          <HubTabButton active={tab === 'content'} label="إدارتي" Icon={LayoutGrid} onPress={() => setTab('content')} />
          <HubTabButton active={tab === 'settings'} label="الإعدادات" Icon={Settings} onPress={() => setTab('settings')} />
        </View>

        {tab === 'profile' ? (
          <View style={styles.stack}>
            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>ملفي العام</Text>
                  <Text style={styles.sectionSub}>نفس المعلومات التي يراها الآخرون في حيّنا</Text>
                </View>
                <Pressable oasisKind="action" style={styles.ghostButton} onPress={() => setEditing((value) => !value)}>
                  <Text style={styles.ghostButtonText}>{editing ? 'إغلاق' : 'تعديل'}</Text>
                </Pressable>
              </View>

              {editing ? (
                <View style={styles.formStack}>
                  <Field label="الاسم الظاهر" value={displayName} onChangeText={setDisplayName} placeholder="اسمك أو اسمك الشخصي" />
                  <Field label="اسم المستخدم" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" />
                  <Field label="النبذة" value={bio} onChangeText={setBio} placeholder="عرّف بنفسك باختصار" multiline />
                  <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryButton} onPress={() => void saveProfile()} disabled={saving}>

                    {saving ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Save size={16} color={OASIS.colors.surface} />}
                    <Text style={styles.primaryButtonText}>حفظ الملف</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.bio}>{profile.bio || 'أضف نبذة قصيرة حتى يعرفك أهل الحي بشكل أفضل.'}</Text>
                  <View style={styles.rowActions}>
                    <Pressable oasisKind="action" style={styles.outlineButton} onPress={() => router.push({ pathname: '/user', params: { id: userId } })}>
                      <Eye size={15} color="#0F766E" />
                      <Text style={styles.outlineButtonText}>عرض الملف العام</Text>
                    </Pressable>
                    <Pressable oasisKind="action" style={styles.outlineButton} onPress={() => void Share.share({ message: 'https://appksatest.vercel.app/user?id=' + userId })}>
                      <Users size={15} color="#0F766E" />
                      <Text style={styles.outlineButtonText}>مشاركة</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>هوية الحساب والتوثيق</Text>
                  <Text style={styles.sectionSub}>نوع الحساب والتوثيق منفصلان، ولا تتغير الصفة العامة حتى تعتمدها الإدارة</Text>
                </View>
                <View style={[styles.identitySquare, { backgroundColor: identityMeta.softColor }]}>
                  <IdentityMetaIcon size={23} color={identityMeta.color} />
                </View>
              </View>

              <View style={styles.identitySummary}>
                <View style={styles.identitySummaryCopy}>
                  <Text style={styles.identityCurrent}>{identityMeta.publicTitle}</Text>
                  <Text style={styles.identityDescription}>{profile.freelance_trade || identityMeta.description}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: verificationPending ? OASIS.colors.warningSoft : profile.is_verified ? identityMeta.softColor : OASIS.colors.background }]}>
                  {verificationPending ? <RefreshCw size={13} color="#B45309" /> : <ShieldCheck size={13} color={profile.is_verified ? identityMeta.color : OASIS.colors.muted} />}
                  <Text style={[styles.statusChipText, { color: verificationPending ? '#B45309' : profile.is_verified ? identityMeta.color : OASIS.colors.muted }]}>
                    {verificationPending ? 'طلب قيد المراجعة' : profile.is_verified ? 'موثّق' : 'غير موثّق'}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.identityManage} onPress={() => setIdentityOpen((value) => !value)}>
                <Text style={styles.identityManageText}>{identityOpen ? 'إغلاق إدارة الهوية' : 'تغيير نوع الحساب أو طلب التوثيق'}</Text>
                <ChevronLeft size={16} color={OASIS.colors.primary} />
              </Pressable>

              {identityOpen ? (
                <View style={styles.identityEditor}>
                  <View style={styles.typeGrid}>
                    {ACCOUNT_TYPES.map((type) => {
                      const meta = getAccountIdentityMeta('user', type.key, false);
                      const Icon = meta.Icon;
                      const active = identityType === type.key;
                      return (
                        <Pressable
                          key={type.key}
                          style={[styles.typeChoice, active && { borderColor: meta.color, backgroundColor: meta.softColor }]}
                          onPress={() => setIdentityType(type.key)}
                        >
                          <View style={[styles.typeChoiceIcon, { backgroundColor: meta.backgroundColor }]}><Icon size={18} color={meta.color} /></View>
                          <View style={styles.typeChoiceCopy}>
                            <Text style={[styles.typeChoiceTitle, active && { color: meta.color }]}>{type.label}</Text>
                            <Text style={styles.typeChoiceSub}>{type.description}</Text>
                          </View>
                          {active ? <Check size={16} color={meta.color} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  {identityType !== 'standard' ? (
                    <Field
                      label={identityType === 'merchant' ? 'اسم المنشأة أو النشاط' : 'اسم المجال أو النشاط'}
                      value={professionalName}
                      onChangeText={setProfessionalName}
                      placeholder={identityType === 'merchant' ? 'مثال: متجر حيّنا' : 'مثال: تصميم وبرمجة'}
                    />
                  ) : null}

                  <Pressable oasisKind="action" style={styles.evidenceButton} onPress={() => void chooseEvidence()}>
                    <Package size={16} color="#0F766E" />
                    <View style={styles.evidenceCopy}>
                      <Text style={styles.evidenceTitle}>{evidence ? 'تم اختيار مستند' : 'إرفاق إثبات الصفة'}</Text>
                      <Text style={styles.evidenceSub}>{evidence?.fileName || 'صورة الوثيقة تحفظ بشكل خاص ولا تظهر للعامة'}</Text>
                    </View>
                  </Pressable>

                  <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryButton} onPress={() => void submitIdentityRequest()} disabled={identitySaving || verificationPending}>

                    {identitySaving ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <ShieldCheck size={16} color={OASIS.colors.surface} />}
                    <Text style={styles.primaryButtonText}>{verificationPending ? 'بانتظار مراجعة الإدارة' : 'إرسال طلب المراجعة'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>موقع الحساب</Text>
                  <Text style={styles.sectionSub}>يستخدم للحي، السوق والمحتوى القريب منك</Text>
                </View>
                <MapPin size={20} color="#0F766E" />
              </View>
              <OasisSurface oasisSurface="card" style={styles.locationCard}>
                <Text style={styles.locationMain}>{[profile.region, profile.city, profile.district && 'حي ' + profile.district].filter(Boolean).join(' · ') || 'لم يحدد بعد'}</Text>
                <Pressable oasisKind="action" style={styles.smallButton} onPress={() => void updateCurrentLocation()} disabled={locationBusy}>
                  {locationBusy ? <ActivityIndicator size="small" color="#0F766E" /> : <RefreshCw size={14} color="#0F766E" />}
                  <Text style={styles.smallButtonText}>تحديث من موقعي</Text>
                </Pressable>
              </OasisSurface>
            </SectionCard>
          </View>
        ) : null}

        {tab === 'content' ? (
          <View style={styles.stack}>
            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>إضافة وإدارة المحتوى</Text>
                  <Text style={styles.sectionSub}>المنتجات والخدمات والمنشأة مرتبطة بحسابك تلقائيًا</Text>
                </View>
                <Plus size={22} color={OASIS.colors.primary} />
              </View>

              <View style={styles.actionGrid}>
                {capabilities.can_publish_products ? (
                  <QuickAction label="إضافة منتج" sub={profile.account_type === 'merchant' ? 'منتج للمنشأة' : 'بيع شخصي'} Icon={ShoppingBag} onPress={() => openAdd('product')} />
                ) : null}
                <QuickAction
                  label="إضافة خدمة"
                  sub={capabilities.can_publish_services ? 'خدمة مهنية' : 'يتطلب حسابًا مهنيًا'}
                  Icon={Wrench}
                  disabled={!capabilities.can_publish_services}
                  onPress={() => openAdd('service')}
                />
                {capabilities.can_manage_business ? (
                  <QuickAction label="منشأتي" sub="البيانات والظهور التجاري" Icon={Store} onPress={() => setContentFilter('all')} />
                ) : (
                  <QuickAction label="تحويل لتجاري" sub="اطلب اعتماد منشأة" Icon={BriefcaseBusiness} onPress={() => { setTab('profile'); setIdentityType('merchant'); setIdentityOpen(true); }} />
                )}
                <QuickAction label="المفضلة" sub="كل ما حفظته" Icon={Heart} onPress={() => router.push('/favorites')} />
              </View>
            </SectionCard>

            {business && capabilities.can_manage_business ? (
              <SectionCard>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionTitle}>المنشأة المرتبطة بالحساب</Text>
                    <Text style={styles.sectionSub}>أي منتج أو خدمة تجارية جديدة ترتبط بهذه المنشأة تلقائيًا</Text>
                  </View>
                  <Store size={21} color="#B7791F" />
                </View>
                <View style={styles.formStack}>
                  <Field label="اسم المنشأة" value={business.name || ''} onChangeText={(value: string) => setBusiness((current: any) => ({ ...current, name: value }))} />
                  <Field label="نبذة عن المنشأة" value={business.description || ''} onChangeText={(value: string) => setBusiness((current: any) => ({ ...current, description: value }))} multiline />
                  <View style={styles.twoFields}>
                    <View style={styles.flexField}><Field label="الجوال" value={business.phone || ''} onChangeText={(value: string) => setBusiness((current: any) => ({ ...current, phone: value }))} keyboardType="phone-pad" /></View>
                    <View style={styles.flexField}><Field label="واتساب" value={business.whatsapp || ''} onChangeText={(value: string) => setBusiness((current: any) => ({ ...current, whatsapp: value }))} keyboardType="phone-pad" /></View>
                  </View>
                  <Pressable style={styles.outlineButtonWide} onPress={() => void saveBusiness()} disabled={saving}>
                    <Save size={15} color="#0F766E" />
                    <Text style={styles.outlineButtonText}>حفظ بيانات المنشأة</Text>
                  </Pressable>
                </View>
              </SectionCard>
            ) : null}

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>محتواي</Text>
                  <Text style={styles.sectionSub}>{totalOwned} عنصر مرتبط بالحساب</Text>
                </View>
                <Package size={20} color={OASIS.colors.muted} />
              </View>

              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { direction: 'ltr' }]}>
                <FilterChip active={contentFilter === 'all'} label="الكل" onPress={() => setContentFilter('all')} />
                <FilterChip active={contentFilter === 'products'} label={'المنتجات ' + products.length} onPress={() => setContentFilter('products')} />
                <FilterChip active={contentFilter === 'services'} label={'الخدمات ' + services.length} onPress={() => setContentFilter('services')} />
                <FilterChip active={contentFilter === 'community'} label={'المجتمع ' + (questions.length + requests.length)} onPress={() => setContentFilter('community')} />
              </ScrollView>

              {filteredContent.length ? (
                <View style={styles.contentList}>
                  {filteredContent.map(({ kind, item }) => (
                    <OwnedRow key={kind + ':' + item.id} kind={kind} item={item} onPress={() => openOwnedItem(kind, item)} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Package size={28} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>لا يوجد محتوى في هذا القسم</Text>
                  <Text style={styles.emptySub}>استخدم أزرار الإضافة بالأعلى، وسيظهر كل شيء هنا تلقائيًا.</Text>
                </View>
              )}
            </SectionCard>

            {(capabilities.can_promote || profile.role === 'admin') ? (
              <SectionCard>
                <Pressable style={styles.navigationRow} onPress={() => router.push('/marketplace-dashboard')}>
                  <View style={[styles.navigationIcon, { backgroundColor: '#FFF7ED' }]}><Sparkles size={18} color="#C2410C" /></View>
                  <View style={styles.navigationCopy}>
                    <Text style={styles.navigationTitle}>الترويج والاشتراكات</Text>
                    <Text style={styles.navigationSub}>الباقات، الحملات المدفوعة وسجل المدفوعات</Text>
                  </View>
                  <ChevronLeft size={18} color="#94A3B8" />
                </Pressable>
              </SectionCard>
            ) : null}
          </View>
        ) : null}

        {tab === 'settings' ? (
          <View style={styles.stack}>
            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>الخصوصية والتواصل</Text>
                  <Text style={styles.sectionSub}>تحكم بمن يشاهد حسابك ويتواصل معك</Text>
                </View>
                <Lock size={20} color="#0F766E" />
              </View>

              <ToggleRow title="حساب خاص" sub="لا يظهر نشاطك لغير المتابعين" value={profile.profile_privacy === 'private'} onValueChange={(value: boolean) => void savePrivacy({ profile_privacy: value ? 'private' : 'public' })} />
              <ToggleRow title="إخفاء الاسم" sub="يظهر الحساب كجار مجهول في السياقات العامة" value={Boolean(profile.hide_name)} onValueChange={(value: boolean) => void savePrivacy({ hide_name: value })} />

              <ChoiceGroup
                label="الرسائل الخاصة"
                value={profile.allow_dms || 'everyone'}
                options={[['everyone','الجميع'],['followers','المتابعون'],['nobody','إيقاف الخاص']]}
                onChange={(value: string) => void savePrivacy({ allow_dms: value })}
              />
              <ChoiceGroup
                label="الرد على القصص"
                value={profile.allow_story_replies || 'everyone'}
                options={[['everyone','الجميع'],['followers','المتابعون'],['nobody','إيقاف الردود']]}
                onChange={(value: string) => void savePrivacy({ allow_story_replies: value })}
              />
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>الإشعارات والهدوء</Text>
                  <Text style={styles.sectionSub}>تنبيهات الجهاز وفترة عدم الإزعاج</Text>
                </View>
                {pushEnabled ? <Bell size={20} color={OASIS.colors.primary} /> : <BellOff size={20} color={OASIS.colors.muted} />}
              </View>

              <ToggleRow title="إشعارات الجهاز" sub={pushEnabled ? 'التنبيهات مفعلة على هذا الجهاز' : 'فعّل تنبيهات الرسائل والأحداث المهمة'} value={pushEnabled} onValueChange={() => void togglePush()} disabled={pushBusy} />
              <ToggleRow title="عدم الإزعاج" sub="إيقاف التنبيهات خلال الفترة المحددة" value={Boolean(dnd.enabled)} onValueChange={(value: boolean) => void saveDndSettings(value)} />
              <View style={styles.twoFields}>
                <View style={styles.flexField}><Field label="من" value={dndStart} onChangeText={setDndStart} placeholder="22:00" /></View>
                <View style={styles.flexField}><Field label="إلى" value={dndEnd} onChangeText={setDndEnd} placeholder="07:00" /></View>
              </View>
              <Pressable style={styles.outlineButtonWide} onPress={() => void saveDndSettings(Boolean(dnd.enabled), dndStart, dndEnd)}>
                <Save size={15} color="#0F766E" />
                <Text style={styles.outlineButtonText}>حفظ فترة الهدوء</Text>
              </Pressable>
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>مظهر التطبيق</Text>
                  <Text style={styles.sectionSub}>التبديل بين الوضع الداكن والفاتح وتلقائي النظام</Text>
                </View>
                <Moon size={20} color="#6366F1" />
              </View>
              <View style={{ marginTop: 6 }}>
                <ThemeToggle />
              </View>
            </SectionCard>

            <View onLayout={(event) => {
              designY.current = event.nativeEvent.layout.y;
              if ((Array.isArray(params.section) ? params.section[0] : params.section) === 'design' && !designScrolled.current) {
                setTimeout(() => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, designY.current - 10), animated: true });
                  designScrolled.current = true;
                }, 120);
              }
            }}>
              <SectionCard>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionTitle}>استوديو المظهر</Text>
                    <Text style={styles.sectionSub}>الألوان والخلفية والأقسام — مربوطة بملفك العام</Text>
                  </View>
                  <Palette size={20} color="#7C3AED" />
                </View>
              </SectionCard>
            </View>

            <ProfileDesignStudio
              userId={userId}
              profile={profile}
              customization={customization}
              displayName={publicName}
              stats={{ followers: stats.followers, following: stats.following, content: totalOwned, reputation: stats.reputation }}
              coverUri={profileCoverUrl(userId, coverVersion)}
              coverVisible={coverState !== 'missing'}
              coverBusy={coverBusy}
              items={[
                ...products.map((item) => ({ type: 'market' as FeaturedType, id: item.id, title: item.title, subtitle: item.status, image: item.image_url })),
                ...services.map((item) => ({ type: 'service' as FeaturedType, id: item.id, title: item.name, subtitle: item.moderation_status || item.activity_status, image: item.cover_url })),
                ...questions.map((item) => ({ type: 'question' as FeaturedType, id: item.id, title: item.title, subtitle: item.status, image: null })),
                ...requests.map((item) => ({ type: 'request' as FeaturedType, id: item.id, title: item.title, subtitle: item.status, image: null })),
              ]}
              featured={featured}
              wide={wide}
              onPickCover={() => void pickCover()}
              onRemoveCover={() => void removeCover()}
              onChange={(patch) => void saveCustomization(patch)}
              onToggleFeatured={(type, id) => void toggleFeatured(type, id)}
              onSaveFeaturedTitle={(title) => void saveCustomization({ featured_title: title })}
              onReset={() => void resetDesign()}
            />

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>الحساب والأمان</Text>
                  <Text style={styles.sectionSub}>البريد وكلمة المرور</Text>
                </View>
                <ShieldCheck size={20} color="#2563EB" />
              </View>
              <Field label="البريد الإلكتروني" value={emailDraft} onChangeText={setEmailDraft} keyboardType="email-address" autoCapitalize="none" />
              <Pressable style={styles.outlineButtonWide} onPress={() => void changeEmail()} disabled={settingsSaving}>
                <Text style={styles.outlineButtonText}>تحديث البريد</Text>
              </Pressable>
              <View style={styles.divider} />
              <Field label="كلمة مرور جديدة" value={passwordDraft} onChangeText={setPasswordDraft} secureTextEntry placeholder="8 أحرف على الأقل" />
              <Field label="تأكيد كلمة المرور" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry />
              <Pressable style={styles.outlineButtonWide} onPress={() => void changePassword()} disabled={settingsSaving}>
                <KeyRound size={15} color="#0F766E" />
                <Text style={styles.outlineButtonText}>تغيير كلمة المرور</Text>
              </Pressable>
            </SectionCard>

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>المحظورون</Text>
                  <Text style={styles.sectionSub}>{blockedUsers.length ? blockedUsers.length + ' حساب محظور' : 'لا توجد حسابات محظورة'}</Text>
                </View>
                <UserX size={20} color={OASIS.colors.muted} />
              </View>
              {blockedUsers.length ? blockedUsers.map((person) => (
                <View key={person.id} style={styles.blockedRow}>
                  <View style={styles.blockedAvatar}>
                    {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.blockedAvatarImage} /> : <UserRound size={18} color={OASIS.colors.muted} />}
                  </View>
                  <View style={styles.blockedCopy}>
                    <Text style={styles.blockedName}>{blockedDisplayName(person)}</Text>
                    <Text style={styles.blockedHandle}>@{person.username || 'user'}</Text>
                  </View>
                  <Pressable oasisKind="action" style={styles.unblockButton} onPress={() => void unblockUser(person.id)}>
                    <Text style={styles.unblockText}>إلغاء الحظر</Text>
                  </Pressable>
                </View>
              )) : <Text style={styles.emptySub}>لن تظهر هنا إلا الحسابات التي قمت بحظرها.</Text>}
            </SectionCard>

            <SectionCard>
              <Pressable style={styles.navigationRow} onPress={() => router.push('/support')}>
                <View style={[styles.navigationIcon, { backgroundColor: OASIS.colors.infoSoft }]}><MessageCircle size={18} color="#2563EB" /></View>
                <View style={styles.navigationCopy}><Text style={styles.navigationTitle}>الدعم والمساعدة</Text><Text style={styles.navigationSub}>تذاكرك والتواصل مع فريق حيّنا</Text></View>
                <ChevronLeft size={18} color="#94A3B8" />
              </Pressable>
              {profile.role === 'admin' ? (
                <>
                  <View style={styles.divider} />
                  <Pressable style={styles.navigationRow} onPress={() => router.push('/admin')}>
                    <View style={[styles.navigationIcon, { backgroundColor: '#F3E8FF' }]}><ShieldCheck size={18} color="#7C3AED" /></View>
                    <View style={styles.navigationCopy}><Text style={styles.navigationTitle}>لوحة الإدارة</Text><Text style={styles.navigationSub}>إدارة المنصة والصلاحيات</Text></View>
                    <ChevronLeft size={18} color="#94A3B8" />
                  </Pressable>
                </>
              ) : null}
            </SectionCard>

            <SectionCard>
              <Pressable oasisKind="action" oasisVariant="danger" style={styles.signOutButton} onPress={() => void supabase.auth.signOut().then(() => router.replace('/auth'))}>
                <LogOut size={17} color={OASIS.colors.danger} />
                <Text style={styles.signOutText}>تسجيل الخروج</Text>
              </Pressable>
              <Pressable oasisKind="action" oasisVariant="danger" style={styles.deleteButton} onPress={confirmDeleteAccount}>
                <Trash2 size={17} color={OASIS.colors.danger} />
                <Text style={styles.deleteText}>حذف الحساب نهائيًا</Text>
              </Pressable>
            </SectionCard>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <OasisSurface oasisSurface="card" style={styles.card}>{children}</OasisSurface>;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value > 999 ? '999+' : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HubTabButton({ active, label, Icon, onPress }: { active: boolean; label: string; Icon: any; onPress: () => void }) {
  return (
    <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip" style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Icon size={17} color={active ? OASIS.colors.surface : OASIS.colors.muted} />
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field(props: any) {
  const { label, multiline, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        multiline={multiline}
        textAlign="right"
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ToggleRow({ title, sub, value, onValueChange, disabled }: any) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={Boolean(value)}
        onValueChange={onValueChange}
        trackColor={{ false: OASIS.colors.line, true: '#A7F3D0' }}
        thumbColor={value ? OASIS.colors.primary : '#94A3B8'}
      />
    </View>
  );
}

function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <View style={styles.choiceWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([id, title]) => (
          <Pressable key={id} style={[styles.choice, value === id && styles.choiceActive]} onPress={() => onChange(id)}>
            <Text style={[styles.choiceText, value === id && styles.choiceTextActive]}>{title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function QuickAction({ label, sub, Icon, onPress, disabled }: any) {
  return (
    <Pressable style={[styles.quickAction, disabled && styles.quickActionDisabled]} onPress={onPress}>
      <View style={styles.quickActionIcon}><Icon size={20} color={disabled ? '#94A3B8' : OASIS.colors.primary} /></View>
      <View style={styles.quickActionCopy}><Text style={styles.quickActionTitle}>{label}</Text><Text style={styles.quickActionSub}>{sub}</Text></View>
      <ChevronLeft size={17} color="#94A3B8" />
    </Pressable>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip" style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function OwnedRow({ kind, item, onPress }: { kind: string; item: any; onPress: () => void }) {
  const isProduct = kind === 'product';
  const isService = kind === 'service';
  const isQuestion = kind === 'question';
  const title = isProduct ? item.title : isService ? item.name : item.title;
  const status = isProduct ? item.status : isService ? item.moderation_status || item.activity_status : item.status;
  const Icon = isProduct ? ShoppingBag : isService ? Wrench : isQuestion ? MessageCircle : Package;
  const image = isProduct ? item.image_url : isService ? item.cover_url : null;
  return (
    <Pressable style={styles.ownedRow} onPress={onPress}>
      <View style={styles.ownedThumb}>
        {image ? <Image source={{ uri: image }} style={styles.ownedImage} /> : <Icon size={20} color="#0F766E" />}
      </View>
      <View style={styles.ownedCopy}>
        <Text style={styles.ownedType}>{isProduct ? 'منتج' : isService ? 'خدمة' : isQuestion ? 'استفسار' : 'طلب'}</Text>
        <Text style={styles.ownedTitle} numberOfLines={1}>{title || 'بدون عنوان'}</Text>
        <Text style={styles.ownedStatus}>{statusLabel(status)}</Text>
      </View>
      <ChevronLeft size={18} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OASIS.colors.background },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: OASIS.colors.background },
  loadingText: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '700' },
  headerAction: { width: 36, height: 36, borderRadius: 14, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 14, paddingTop: 12, gap: 14, maxWidth: 920, width: '100%', alignSelf: 'center' },
  profileHero: { borderWidth: 1, borderColor: OASIS.colors.line, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, minHeight: 138, borderRadius: 18, overflow: 'hidden' },
  profileHeroWide: { minHeight: 156, padding: 20 },
  heroCoverButton: { position: 'absolute', left: 12, top: 12, minHeight: 32, borderRadius: 10, paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, zIndex: 3 },
  heroCoverButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, position: 'relative', borderWidth: 3, borderColor: OASIS.colors.soft },
  avatar: { width: '100%', height: '100%', borderRadius: 40 },
  avatarFallback: { flex: 1, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.soft },
  avatarLetter: { fontSize: 31, color: OASIS.colors.primary, fontWeight: '700' },
  cameraBadge: { position: 'absolute', left: -2, bottom: -2, width: 27, height: 27, borderRadius: 14, backgroundColor: OASIS.colors.primary, borderWidth: 2, borderColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  identityIcon: { position: 'absolute', right: -4, top: -4 },
  heroCopy: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  publicName: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', textAlign: 'right', maxWidth: '100%' },
  handle: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  badgeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  locationLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 7 },
  locationText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700' },
  statsBar: { flexDirection: 'row-reverse', backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 11, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  statValue: { color: OASIS.colors.ink, fontSize: 16, fontWeight: '700' },
  statLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  tabs: { flexDirection: 'row-reverse', backgroundColor: OASIS.colors.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: OASIS.colors.line, gap: 4 },
  tabButton: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabButtonActive: { backgroundColor: OASIS.colors.primary },
  tabButtonText: { color: OASIS.colors.muted, fontSize: 11.5, fontWeight: '700' },
  tabButtonTextActive: { color: OASIS.colors.surface },
  stack: { gap: 12 },
  card: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, padding: 14, gap: 12 },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionHeaderCopy: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: OASIS.colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  sectionSub: { color: OASIS.colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  ghostButton: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F1F5F9' },
  ghostButtonText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  bio: { color: OASIS.colors.ink, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  rowActions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  outlineButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: OASIS.colors.soft, backgroundColor: OASIS.colors.soft, paddingHorizontal: 11, minHeight: 38, borderRadius: 11 },
  outlineButtonWide: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: OASIS.colors.soft, backgroundColor: OASIS.colors.soft, paddingHorizontal: 11, minHeight: 42, borderRadius: 12 },
  outlineButtonText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
  formStack: { gap: 10 },
  fieldWrap: { gap: 5 },
  fieldLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 43, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.background, borderRadius: 12, paddingHorizontal: 11, color: OASIS.colors.ink, fontSize: 12, fontWeight: '700' },
  inputMultiline: { minHeight: 86, textAlignVertical: 'top', paddingTop: 10 },
  primaryButton: { minHeight: 44, borderRadius: 0, backgroundColor: 'transparent', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '700' },
  identitySquare: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  identitySummary: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: OASIS.colors.background, borderRadius: 14, padding: 11 },
  identitySummaryCopy: { flex: 1, alignItems: 'flex-end' },
  identityCurrent: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700' },
  identityDescription: { color: OASIS.colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', marginTop: 2 },
  statusChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  identityManage: { minHeight: 42, borderRadius: 12, backgroundColor: OASIS.colors.soft, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  identityManageText: { color: OASIS.colors.primary, fontSize: 11.5, fontWeight: '700' },
  identityEditor: { gap: 11, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 11 },
  typeGrid: { gap: 7 },
  typeChoice: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 9 },
  typeChoiceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeChoiceCopy: { flex: 1, alignItems: 'flex-end' },
  typeChoiceTitle: { color: OASIS.colors.ink, fontSize: 11.5, fontWeight: '700' },
  typeChoiceSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  evidenceButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 44, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7F3D0', backgroundColor: OASIS.colors.soft, borderRadius: 13, padding: 10 },
  evidenceCopy: { flex: 1, alignItems: 'flex-end' },
  evidenceTitle: { color: OASIS.colors.primary, fontSize: 11.5, fontWeight: '700' },
  evidenceSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  locationCard: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: OASIS.colors.background, padding: 11, borderRadius: 13 },
  locationMain: { flex: 1, color: OASIS.colors.ink, fontSize: 11.5, fontWeight: '600', textAlign: 'right' },
  smallButton: { minHeight: 34, borderRadius: 10, backgroundColor: OASIS.colors.soft, paddingHorizontal: 9, flexDirection: 'row-reverse', gap: 5, alignItems: 'center' },
  smallButtonText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
  actionGrid: { gap: 8 },
  quickAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 58, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14, padding: 10 },
  quickActionDisabled: { opacity: 0.58, backgroundColor: OASIS.colors.background },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  quickActionCopy: { flex: 1, alignItems: 'flex-end' },
  quickActionTitle: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '700' },
  quickActionSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  twoFields: { flexDirection: 'row-reverse', gap: 8 },
  flexField: { flex: 1 },
  filterRow: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 2 },
  filterChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: OASIS.colors.primary },
  filterChipText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: OASIS.colors.surface },
  contentList: { gap: 7 },
  ownedRow: { minHeight: 56, borderRadius: 13, borderWidth: 1, borderColor: '#EDF2F7', padding: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  ownedThumb: { width: 43, height: 43, borderRadius: 11, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ownedImage: { width: '100%', height: '100%' },
  ownedCopy: { flex: 1, alignItems: 'flex-end' },
  ownedType: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  ownedTitle: { color: OASIS.colors.ink, fontSize: 11.5, fontWeight: '700', marginTop: 1, textAlign: 'right' },
  ownedStatus: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  emptyTitle: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 11, textAlign: 'center', lineHeight: 18 },
  navigationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 52 },
  navigationIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navigationCopy: { flex: 1, alignItems: 'flex-end' },
  navigationTitle: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '700' },
  navigationSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  toggleRow: { minHeight: 56, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 5 },
  toggleCopy: { flex: 1, alignItems: 'flex-end' },
  toggleTitle: { color: OASIS.colors.ink, fontSize: 11.5, fontWeight: '700' },
  toggleSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, lineHeight: 17, textAlign: 'right' },
  choiceWrap: { gap: 6, paddingTop: 4 },
  choiceRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  choice: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F1F5F9' },
  choiceActive: { backgroundColor: OASIS.colors.primary },
  choiceText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  choiceTextActive: { color: OASIS.colors.surface },
  colorRow: { flexDirection: 'row-reverse', gap: 9, flexWrap: 'wrap' },
  colorDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: OASIS.colors.surface },
  colorDotActive: { borderColor: OASIS.colors.ink },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 2 },
  blockedRow: { minHeight: 54, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  blockedAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blockedAvatarImage: { width: '100%', height: '100%' },
  blockedCopy: { flex: 1, alignItems: 'flex-end' },
  blockedName: { color: OASIS.colors.ink, fontSize: 11, fontWeight: '700' },
  blockedHandle: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  unblockButton: { borderRadius: 9, backgroundColor: OASIS.colors.dangerSoft, paddingHorizontal: 9, paddingVertical: 6 },
  unblockText: { color: OASIS.colors.danger, fontSize: 11, fontWeight: '700' },
  signOutButton: { minHeight: 45, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: OASIS.colors.dangerSoft },
  signOutText: { color: OASIS.colors.danger, fontSize: 11.5, fontWeight: '700' },
  deleteButton: { minHeight: 45, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#FECACA' },
  deleteText: { color: OASIS.colors.danger, fontSize: 11.5, fontWeight: '700' },
});
