import { PROFILE_READ_FIELDS } from '@/lib/profileFields';
import { AppearanceSettings } from '@/components/account/AppearanceSettings';
import { useTheme } from '@/context/ThemeContext';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { ProfileContactSettings } from '@/components/profile/ProfileContactSettings';
import { OfficialDocumentVerification } from '@/components/profile/OfficialDocumentVerification';
import { ProfileConnections } from '@/components/profile/ProfileConnections';
import { validateProfileDraft } from '@/lib/profileEditor';
import { OasisArtwork } from '@/components/oasis/OasisPrimitives';
import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Image, ImageBackground, Platform, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  Phone,
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

import { AppHeader } from '@/components/shared/AppHeader';
import {
  getAccountIdentityMeta,
  type AccountKind,
} from '@/components/profile/AccountIdentityBadge';
import { supabase } from '@/lib/supabase';
import { ProfileDesignStudio, type FeaturedType, type StudioItem, type FeaturedRow } from '@/components/profile/ProfileDesignStudio';
import { bannerColors, DEFAULT_FEATURED_TITLE, DEFAULT_SECTION_VISIBILITY, DEFAULT_SECTION_ORDER, DEFAULT_PROFILE_TYPE, MAX_FEATURED, DEFAULT_PROFILE_CUSTOMIZATION } from '@/lib/profileTheme';
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

type SettingsSection = 'privacy' | 'location' | 'notifications' | 'appearance' | 'design' | 'security' | 'blocked' | 'help' | 'account';
const SETTINGS_SECTIONS: {id: SettingsSection; label: string; Icon: any; description: string}[] = [
{id:'privacy',label:'الخصوصية والتواصل',Icon:Lock,description:'رقم التواصل، الخصوصية والرسائل'},
{id:'location',label:'الموقع والحي',Icon:MapPin,description:'تحديد الحي والمدينة وتحديث الموقع'},
{id:'notifications',label:'الإشعارات',Icon:Bell,description:'تنبيهات الجهاز وعدم الإزعاج'},
{id:'appearance',label:'مظهر التطبيق',Icon:Moon,description:'الوضع الفاتح والداكن'},
{id:'design',label:'تخصيص البروفايل',Icon:Palette,description:'الغلاف والألوان والأعمال المثبتة'},
{id:'security',label:'الحساب والأمان',Icon:ShieldCheck,description:'البريد الإلكتروني وكلمة المرور'},
{id:'blocked',label:'الحسابات المحظورة',Icon:UserX,description:'إدارة قائمة الحظر'},
{id:'help',label:'المساعدة والدعم',Icon:MessageCircle,description:'تواصل مع فريق حيّنا'},
{id:'account',label:'إدارة الحساب',Icon:Settings,description:'تسجيل الخروج وحذف الحساب'}
];

const SETTINGS_GROUPS: { title: string; subtitle: string; ids: SettingsSection[] }[] = [
  { title: 'ملفي وخصوصيتي', subtitle: 'التحكم بمعلوماتك وظهور حسابك', ids: ['privacy', 'location', 'security'] },
  { title: 'التطبيق والمظهر', subtitle: 'الإشعارات والمظهر وتخصيص الصفحة', ids: ['notifications', 'appearance', 'design'] },
  { title: 'المساعدة وإدارة الحساب', subtitle: 'الحظر والدعم وخيارات الحساب', ids: ['blocked', 'help', 'account'] },
];

type HubTab = 'profile' | 'verification' | 'content' | 'settings';
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
  if (value === 'verification' || value === 'identity') return 'verification';
  if (value === 'settings' || SETTINGS_SECTIONS.some(item => item.id === value)) return 'settings';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  const [notice, setNotice] = useState<{title:string;message:string} | null>(null);
  const [confirmation, setConfirmation] = useState<{title:string;message:string;buttons:NonNullable<Parameters<typeof Alert.alert>[2]>} | null>(null);
  const notify = (title: string, message = '', buttons?: Parameters<typeof Alert.alert>[2]) => {
    if (buttons?.length) setConfirmation({title,message,buttons});
    else {setNotice({title,message});scrollRef.current?.scrollTo({y:0,animated:true});}
  };
  const [loadError, setLoadError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [connections, setConnections] = useState<'followers'|'following'|null>(null);
  const [contentTotals,setContentTotals] = useState({products:0,services:0,questions:0,requests:0});
  const [contentBusy,setContentBusy] = useState(false);
  const contentInFlight=useRef(false);
  const [contributions, setContributions] = useState(0);
  const [designError, setDesignError] = useState('');
  const [designStatus, setDesignStatus] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const designQueue = useRef<Promise<void>>(Promise.resolve());
  const designRevision = useRef(0);
  const customizationSaved = useRef<any>(null);
  const featuredInFlight = useRef(false);
  const [featuredSaving,setFeaturedSaving] = useState(false);
  const customizationLatest = useRef<any>(null);
  const params = useLocalSearchParams<{ tab?: string; section?: string }>();
  const bottomInset = useBottomNavInset();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  const scrollRef = useRef<ScrollView>(null);
  const designY = useRef(0);
  const designScrolled = useRef(false);
  const routeSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const routeTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const requestedTab: HubTab = SETTINGS_SECTIONS.some(item => item.id === routeSection) ? 'settings' : routeSection === 'identity' ? 'verification' : normalizeTab(routeTab);
  const [tab, setTab] = useState<HubTab>(requestedTab);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('privacy');
  const [settingsDetailOpen, setSettingsDetailOpen] = useState<boolean>(SETTINGS_SECTIONS.some(item => item.id === routeSection));

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
  const [businessEditing, setBusinessEditing] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');

  const [verification, setVerification] = useState<any | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityType, setIdentityType] = useState<AccountKind>('standard');
  const [professionalName, setProfessionalName] = useState('');
  const [evidence, setEvidence] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [identitySaving, setIdentitySaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const editorScrolled = useRef(false);
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
    const section = routeSection || routeTab;
    if (section === 'identity') setIdentityOpen(true);
    if (section === 'edit') setEditing(true);
    if (SETTINGS_SECTIONS.some(item => item.id === section)) { setSettingsSection(section as SettingsSection); setSettingsDetailOpen(true); }
    else if (requestedTab === 'settings') setSettingsDetailOpen(false);
  }, [requestedTab, routeSection, routeTab]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setCoverState('loading');
    setLoadError('');
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
        answerCount,
      ] = await Promise.all([
        supabase.from('profiles').select(PROFILE_READ_FIELDS).eq('id', uid).maybeSingle(),
        supabase.rpc('hayna_my_account_capabilities'),
        supabase.from('marketplace_items').select('id,title,description,price,item_type,status,image_url,created_at,business_id', {count:'exact'}).eq('seller_id', uid).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(40),
        supabase.from('services').select('id,name,description,price_from,price_to,price_type,cover_url,activity_status,moderation_status,created_at,business_id', {count:'exact'}).eq('provider_id', uid).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(40),
        supabase.from('questions').select('id,title,body,created_at,status', {count:'exact'}).eq('author_id', uid).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(20),
        supabase.from('requests').select('id,title,description,created_at,status', {count:'exact'}).eq('requester_id', uid).order('created_at', { ascending: false }).order('id',{ascending:false}).limit(20),
        supabase.from('businesses').select('*').eq('owner_id', uid).maybeSingle(),
        supabase.from('verification_requests').select('id,status,subject,note,created_at,reviewed_at').eq('user_id', uid).is('document_number', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profile_customizations').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
        supabase.from('reputation').select('points').eq('user_id', uid).maybeSingle(),
        supabase.from('push_tokens').select('id').eq('user_id', uid).eq('platform', Platform.OS).limit(1),
        supabase.from('profile_featured_items').select('item_type,item_id,position').eq('user_id', uid).order('position', { ascending: true }),
        supabase.from('answers').select('id',{count:'exact',head:true}).eq('author_id',uid),
      ]);

      if (profileRes.error) throw profileRes.error;
      const p = profileRes.data;
      if (!p) throw new Error('تعذر العثور على ملف الحساب.');

      setContentTotals({products:productRes.count || 0,services:serviceRes.count || 0,questions:questionRes.count || 0,requests:requestRes.count || 0});
      setContributions((productRes.count || 0)+(serviceRes.count || 0)+(questionRes.count || 0)+(requestRes.count || 0)+(answerCount.count || 0));
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
      customizationSaved.current = customizationRes.data || DEFAULT_PROFILE_CUSTOMIZATION;
      if ([productRes,serviceRes,questionRes,requestRes,customizationRes,featuredRes].some(result => result.error)) setLoadError('تعذر تحميل بعض محتويات الحساب. اسحب للتحديث أو أعد المحاولة.');
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
      setLoadError(error?.message || 'تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => { customizationLatest.current = customization; }, [customization]);

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

  const draft = { displayName, username, bio };
  const dirty = displayName.trim() !== (profile?.display_name || '') || username.trim().toLowerCase() !== (profile?.username || '').toLowerCase() || bio.trim() !== (profile?.bio || '');
  function beginEditing() {
    editorScrolled.current = false;
    setDisplayName(profile?.display_name || ''); setUsername(profile?.username || ''); setBio(profile?.bio || '');
    setEditing(true); setTab('profile'); router.setParams({tab:'profile',section:'edit'});
  }
  function closeEditor() {
    if (saving) return;
    const close = () => {setDisplayName(profile?.display_name || '');setUsername(profile?.username || '');setBio(profile?.bio || '');setEditing(false);router.setParams({section:undefined});};
    if (dirty) notify('تجاهل التغييرات؟','لم تُحفظ تعديلات الاسم أو النبذة بعد.',[{text:'متابعة التعديل',style:'cancel'},{text:'تجاهل التغييرات',style:'destructive',onPress:close}]);
    else close();
  }
  function navigateTab(next: HubTab, section?: SettingsSection) {
    if (saving) return;
    const go = () => {setEditing(false);setTab(next);if(section) setSettingsSection(section); if(next === 'settings') setSettingsDetailOpen(Boolean(section)); scrollRef.current?.scrollTo({y:0,animated:false});router.setParams({tab:next,section});};
    if (editing && dirty) notify('تغييرات غير محفوظة','احفظ التعديلات أو تجاهلها قبل الانتقال.',[{text:'متابعة التعديل',style:'cancel'},{text:'تجاهل وانتقال',style:'destructive',onPress:go}]);
    else go();
  }
  function openPublicProfile() {
    const go=() => router.push({pathname:'/user',params:{id:userId}});
    if (editing && dirty) notify('تغييرات غير محفوظة','هل تريد تجاهل التعديلات وعرض ملفك العام؟',[{text:'متابعة التعديل',style:'cancel'},{text:'تجاهل وعرض الملف',style:'destructive',onPress:() => {setEditing(false);go();}}]);
    else go();
  }
  useEffect(() => {
    if (Platform.OS !== 'web' || !editing || !dirty) return;
    const handler=(event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',handler);
    return () => window.removeEventListener('beforeunload',handler);
  },[editing,dirty]);
  async function shareProfile() {
    const path = '/user?username=' + encodeURIComponent(profile?.username || userId);
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + path : 'https://appksatest.vercel.app' + path;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {await navigator.clipboard.writeText(url);notify('تم نسخ الرابط','يمكنك الآن مشاركة ملفك الشخصي.');}
      else await Share.share({message:url});
    } catch {notify('تعذر مشاركة الرابط','حاول مرة أخرى.');}
  }
  async function saveProfile() {
    if (!userId || saving || !dirty) return;
    const errors = validateProfileDraft(draft);
    if (Object.keys(errors).length) return notify('راجع بياناتك', Object.values(errors).join('\n'));
    setSaving(true);
    let usernameChanged = false;
    try {
      const nextUsername = username.trim().toLowerCase();
      if (nextUsername !== String(profile?.username || '').toLowerCase()) {
        const changed = await supabase.rpc('change_my_username', {p_username:nextUsername});
        if (changed.error) throw changed.error;
        usernameChanged = true;
        setProfile((previous:any) => ({...previous,username:nextUsername}));
      }
      const patch = {display_name:displayName.trim(),bio:bio.trim() || null};
      const result = await supabase.from('profiles').update(patch).eq('id',userId).select('id,display_name,bio').single();
      if (result.error) throw result.error;
      setProfile((previous:any) => ({...previous,...patch,username:nextUsername}));
      setDisplayName(patch.display_name);setUsername(nextUsername);setBio(patch.bio || '');
      setEditing(false);router.setParams({section:undefined});
      notify('تم حفظ الملف','تم تحديث بياناتك وستظهر في ملفك العام.');
    } catch (error:any) {notify('تعذر إكمال الحفظ',(usernameChanged ? 'تم تحديث اسم المستخدم. تعذر حفظ باقي البيانات: ' : '') + (error?.message || 'حاول مرة أخرى.'));}
    finally {setSaving(false);}
  }

  async function pickAvatar() {
    if (!userId || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.78});
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const body = await (await fetch(asset.uri)).arrayBuffer();
      const path = userId + '/avatar.jpg';
      const upload = await supabase.storage.from('avatars').upload(path, body, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: true,
      });
      if (upload.error) throw upload.error;
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      const saved = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      if (saved.error) throw saved.error;
      setProfile((current: any) => ({ ...(current || {}), avatar_url: url }));
    } catch (error: any) {
      notify('تعذر تحديث الصورة', error?.message || 'حاول مرة أخرى.');
    } finally {setAvatarBusy(false);}
  }

  async function pickCover() {
    if (!userId || coverBusy) return;
    setCoverBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[3,1],quality:0.82});
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadProfileCover(userId, asset);
      setCoverVersion(Date.now());
      setCoverState('ready');
      notify('تم حفظ الغلاف', 'ستظهر الصورة كخلفية لملفك العام.');
    } catch (error: any) {
      notify('تعذر حفظ الغلاف', error?.message || 'حاول مرة أخرى.');
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
      notify('تعذر إزالة الغلاف', error?.message || 'حاول مرة أخرى.');
    } finally {
      setCoverBusy(false);
    }
  }

  async function toggleFeatured(type: FeaturedType, id: string) {
    if (!userId || featuredInFlight.current) return;
    const exists = featured.some((row) => row.item_type === type && row.item_id === id);
    if (!exists && featured.length >= MAX_FEATURED) {
      notify('الحد الأقصى', `يمكن تثبيت حتى ${MAX_FEATURED} عناصر.`);
      return;
    }
    featuredInFlight.current=true;setFeaturedSaving(true);
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
      notify('تعذر تحديث الأعمال المميزة', error?.message || 'حاول مرة أخرى.');
    } finally {featuredInFlight.current=false;setFeaturedSaving(false);}
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
      notify('تعذر تحديث الموقع', error?.message || 'حاول مرة أخرى.');
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
    // Commercial registrations and freelance certificates have their own dedicated flow.
    if (identityType === 'merchant' || identityType === 'freelance') {
      notify('اختر التحقق المتخصص', 'استعمل نموذج السجل التجاري أو وثيقة العمل الحر الظاهر أسفل نوع الحساب.');
      return;
    }
    if (verificationPending) {
      notify('طلب قيد المراجعة', 'لا يمكن إرسال طلب جديد قبل أن تراجع الإدارة الطلب الحالي.');
      return;
    }
    const isProfessional = identityType !== 'standard';
    const needsEvidence = isProfessional || !Boolean(profile?.is_verified);
    if (isProfessional && !professionalName.trim()) {
      notify('بيانات ناقصة', identityType === 'merchant' ? 'اكتب اسم المنشأة أو النشاط التجاري.' : 'اكتب اسم المجال أو النشاط المهني.');
      return;
    }
    if (needsEvidence && !evidence) {
      notify('الإثبات مطلوب', identityType === 'standard'
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

      const verificationType = identityType === 'standard' ? 'identity' : 'business';

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
      notify('تم إرسال الطلب', 'ستبقى الصفة الحالية كما هي حتى تراجع الإدارة الطلب وتوافق عليه.');
    } catch (error: any) {
      if (uploadedPath) await supabase.storage.from('verification-documents').remove([uploadedPath]);
      notify('تعذر إرسال الطلب', error?.message || 'حاول مرة أخرى.');
    } finally {
      setIdentitySaving(false);
    }
  }

  async function savePrivacy(patch: Record<string, any>) {
    if (!userId || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const updated = await supabase.from('profiles').update(patch).eq('id', userId);
      if (updated.error) throw updated.error;
      setProfile((current: any) => ({ ...(current || {}), ...patch }));
    } catch (error: any) {
      notify('تعذر حفظ الإعداد', error?.message || 'حاول مرة أخرى.');
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
      notify('الإشعارات', error?.message || 'تعذر تحديث الإشعارات.');
    } finally {
      setPushBusy(false);
    }
  }

  async function saveDndSettings(enabled: boolean, start = dndStart, end = dndEnd) {
    if (!userId || settingsSaving) return;
    if (enabled && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end)) return notify('راجع فترة الهدوء','أدخل وقتين صالحين ومختلفين بصيغة HH:MM.');
    setSettingsSaving(true);
    try {
      const next: DndSettings = {...dnd,enabled,schedule:enabled ? 'custom':'off',start:enabled ? start : dnd.start,end:enabled ? end : dnd.end};
      const result=await saveDnd(userId,next);
      if (!result.ok) throw new Error(result.error);
      setDnd(next);
      await syncDndWithNotifications(userId);
      notify('تم حفظ الإعدادات',enabled ? 'تم تفعيل فترة الهدوء المحددة.' : 'تم إيقاف عدم الإزعاج.');
    } catch(error:any) {notify('تعذر إكمال الإعداد',error?.message || 'حاول مرة أخرى.');}
    finally {setSettingsSaving(false);}
  }

  async function saveCustomization(patch: Record<string, any>) {
    if (!userId) return;
    const previous = customizationLatest.current || customization;
    const next = {...previous,...patch};
    customizationLatest.current = next;
    setCustomization(next);
    const revision = ++designRevision.current;
    setDesignStatus('saving');setDesignError('');
    const operation = designQueue.current.then(async () => {
      const result = await supabase.from('profile_customizations').upsert({
        user_id:userId,accent_color:next.accent_color || OASIS.colors.primary,
        banner_style:next.banner_style || 'emerald',show_stats:next.show_stats !== false,
        show_badges:next.show_badges !== false,featured_title:next.featured_title || DEFAULT_FEATURED_TITLE,
        section_visibility:next.section_visibility || DEFAULT_SECTION_VISIBILITY,
        section_order:next.section_order || DEFAULT_SECTION_ORDER,profile_type:next.profile_type || DEFAULT_PROFILE_TYPE,
      },{onConflict:'user_id'});
      if (result.error) throw result.error;
      customizationSaved.current=next;
    });
    designQueue.current = operation.catch(() => {});
    try {await operation;if (revision === designRevision.current) setDesignStatus('saved');}
    catch (error:any) {
      if (revision === designRevision.current) {customizationLatest.current=customizationSaved.current || previous;setCustomization(customizationSaved.current || previous);setDesignStatus('error');setDesignError(error?.message || 'تعذر حفظ التخصيص. أعد المحاولة.');}
    }
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
      notify('تم الحفظ', 'تم تحديث بيانات المنشأة.');
    } catch (error: any) {
      notify('تعذر تحديث المنشأة', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    const next = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(next)) return notify('البريد غير صالح', 'أدخل بريدًا إلكترونيًا صحيحًا.');
    setSettingsSaving(true);
    try {
      const result = await supabase.auth.updateUser({ email: next });
      if (result.error) throw result.error;
      notify('تحقق من بريدك', 'تم إرسال رسالة تأكيد إلى البريد الجديد.');
    } catch (error: any) {
      notify('تعذر تغيير البريد', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function changePassword() {
    if (passwordDraft.length < 8) return notify('كلمة المرور قصيرة', 'استخدم 8 أحرف على الأقل.');
    if (passwordDraft !== passwordConfirm) return notify('عدم تطابق', 'تأكيد كلمة المرور غير مطابق.');
    setSettingsSaving(true);
    try {
      const result = await supabase.auth.updateUser({ password: passwordDraft });
      if (result.error) throw result.error;
      setPasswordDraft('');
      setPasswordConfirm('');
      notify('تم التحديث', 'تم تغيير كلمة المرور.');
    } catch (error: any) {
      notify('تعذر تغيير كلمة المرور', error?.message || 'حاول مرة أخرى.');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function unblockUser(targetId: string) {
    if (!userId) return;
    const result = await setBlock(userId, targetId, false);
    if (!result.ok) return notify('تعذر إلغاء الحظر', result.error);
    setBlockedUsers((current) => current.filter((item) => item.id !== targetId));
  }

  function confirmDeleteAccount() {
    notify(
      'حذف الحساب نهائيًا',
      'سيتم حذف بيانات الحساب ولا يمكن التراجع عن هذه العملية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: () => void (async () => {
            const result = await supabase.functions.invoke('delete-account');
            if (result.error) return notify('تعذر الحذف', result.error.message);
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
      notify('يتطلب حسابًا مهنيًا', 'فعّل صفة عمل حر أو مقدم خدمة أو تجاري أولًا، ثم انتظر اعتماد الإدارة.');
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

  const contentRemaining = Math.max(0,contentTotals.products-products.length)+Math.max(0,contentTotals.services-services.length)+Math.max(0,contentTotals.questions-questions.length)+Math.max(0,contentTotals.requests-requests.length);
  async function loadMoreContent(filter: ContentFilter = contentFilter) {
    if (!userId || contentInFlight.current) return;
    contentInFlight.current=true;setContentBusy(true);
    const sources=[
      {table:'marketplace_items',owner:'seller_id',rows:products,total:contentTotals.products,set:setProducts,include:filter==='all'||filter==='products'},
      {table:'services',owner:'provider_id',rows:services,total:contentTotals.services,set:setServices,include:filter==='all'||filter==='services'},
      {table:'questions',owner:'author_id',rows:questions,total:contentTotals.questions,set:setQuestions,include:filter==='all'||filter==='community'},
      {table:'requests',owner:'requester_id',rows:requests,total:contentTotals.requests,set:setRequests,include:filter==='all'||filter==='community'},
    ].filter(source => source.include && source.rows.length<source.total);
    try {
      const results=await Promise.all(sources.map(source => supabase.from(source.table).select('*').eq(source.owner,userId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(source.rows.length,source.rows.length+29)));
      for(const result of results) if (result.error) throw result.error;
      results.forEach((result,index) => sources[index].set(previous => [...previous,...(result.data || []).filter(row => !previous.some(item => item.id===row.id))]));
    } catch(error:any) {notify('تعذر تحميل المزيد',error?.message || 'تحقق من الاتصال ثم أعد المحاولة.');}
    finally {contentInFlight.current=false;setContentBusy(false);}
  }

  const filteredContent = useMemo(() => {
    const all = [
      ...products.map((item) => ({ kind: 'product', item })),
      ...services.map((item) => ({ kind: 'service', item })),
      ...questions.map((item) => ({ kind: 'question', item })),
      ...requests.map((item) => ({ kind: 'request', item })),
    ];
    all.sort((a,b) => new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime());
    if (contentFilter === 'products') return all.filter((row) => row.kind === 'product');
    if (contentFilter === 'services') return all.filter((row) => row.kind === 'service');
    if (contentFilter === 'community') return all.filter((row) => row.kind === 'question' || row.kind === 'request');
    return all.sort((a, b) => new Date(b.item.created_at || 0).getTime() - new Date(a.item.created_at || 0).getTime());
  }, [products, services, questions, requests, contentFilter]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تجهيز مركز حسابك...</Text>
      </View>
    );
  }

  if (!profile) return <View style={[styles.loadingScreen,{backgroundColor:colors.background}]}><UserX size={42} color={colors.muted}/><Text style={{color:colors.ink,fontSize:20,fontWeight:'700'}}>تعذر تحميل حسابك</Text><Text style={{color:colors.muted,textAlign:'center',padding:20}}>{loadError || 'سجل الدخول لعرض بياناتك.'}</Text><Pressable oasisKind="action" oasisVariant="primary" onPress={() => void load()}><Text>إعادة المحاولة</Text></Pressable><Pressable onPress={() => router.replace('/auth')}><Text style={{color:colors.primary}}>تسجيل الدخول</Text></Pressable></View>;

  return (
    <View style={[styles.screen,{backgroundColor:colors.background}]}>
      <ProfileConnections userId={userId} kind={connections} onClose={() => setConnections(null)} />
      <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}><View style={accountStyles.overlay}><View style={[accountStyles.dialog,{backgroundColor:colors.surface}]} accessibilityViewIsModal><Text style={{color:colors.ink,fontSize:21,fontWeight:'800',textAlign:'right'}}>{confirmation?.title}</Text><Text style={{color:colors.muted,lineHeight:25,textAlign:'right'}}>{confirmation?.message}</Text>{confirmation?.buttons.map((item,index) => <Pressable key={index} oasisKind="action" oasisVariant={item.style === 'destructive' ? 'danger' : 'secondary'} onPress={() => {setConfirmation(null);item.onPress?.();}}><Text>{item.text}</Text></Pressable>)}</View></View></Modal>
      <AppHeader
        variant="tab"
        title={tab === 'settings' ? 'الإعدادات' : tab === 'verification' ? 'التوثيق' : tab === 'content' ? 'أعمالي ومحتواي' : editing ? 'تعديل الملف' : 'ملفي الشخصي'}
        subtitle={tab === 'settings' ? (settingsDetailOpen ? SETTINGS_SECTIONS.find(item => item.id === settingsSection)?.label : 'أقسام حسابك') : tab === 'verification' ? 'هوية الحساب والوثائق' : tab === 'content' ? 'المنتجات والخدمات والمشاركات' : 'هويتك في حيّنا'}
        rightAction={tab === 'settings' ? undefined : (
          <Pressable
            style={styles.headerAction}
            onPress={openPublicProfile}
            accessibilityRole="button"
            accessibilityLabel="عرض الملف العام"
          >
            <Eye size={18} color="#0F766E" />
          </Pressable>
        )}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={OASIS.colors.primary} />}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28, maxWidth: 820 }]}
      >
        {!!notice && <View accessibilityRole="alert" style={[accountStyles.notice,{backgroundColor:colors.soft,borderColor:colors.line}]}><View style={{flex:1,alignItems:'flex-end',gap:4}}><Text style={{color:colors.ink,fontWeight:'800'}}>{notice.title}</Text><Text style={{color:colors.muted,fontSize:12,lineHeight:20,textAlign:'right'}}>{notice.message}</Text></View><Pressable accessibilityLabel="إغلاق الرسالة" onPress={() => setNotice(null)}><Text style={{color:colors.primary,padding:8}}>إغلاق</Text></Pressable></View>}
        {!!loadError && <Text accessibilityRole="alert" style={{color:colors.danger,textAlign:'right'}}>{loadError}</Text>}
        <View style={styles.tabs}>
          <HubTabButton active={tab === 'profile'} label="ملفي" Icon={CircleUserRound} onPress={() => navigateTab('profile')} />
          <HubTabButton active={tab === 'verification'} label="التوثيق" Icon={ShieldCheck} onPress={() => navigateTab('verification')} />
          <HubTabButton active={tab === 'content'} label="أعمالي" Icon={LayoutGrid} onPress={() => navigateTab('content')} />
          <HubTabButton active={tab === 'settings'} label="الإعدادات" Icon={Settings} onPress={() => navigateTab('settings')} />
        </View>
        {tab === 'profile' ? (<ProfileHeader profile={editing ? {...profile,display_name:displayName,username,bio} : profile} customization={customization} displayName={editing ? displayName || 'اسمك الظاهر' : publicName} coverUri={coverState === 'missing' ? '' : profileCoverUrl(userId,coverVersion)} stats={{...stats,contributions}} own editableAvatar avatarBusy={avatarBusy} coverBusy={coverBusy} onAvatarPress={() => void pickAvatar()} onCoverPress={() => void pickCover()} onEdit={() => {if (!editing) beginEditing();}} onDesign={() => {navigateTab('settings','design');}} onSettings={() => navigateTab('settings')} onFollowers={() => setConnections('followers')} onFollowing={() => setConnections('following')} />) : <View style={[accountStyles.accountContext,{backgroundColor:colors.surface,borderColor:colors.line}]}>
          {profile.avatar_url ? <Image source={{uri:profile.avatar_url}} style={{width:42,height:42,borderRadius:21}}/> : <View style={{width:42,height:42,borderRadius:21,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.primary,fontWeight:'800'}}>{publicName[0]}</Text></View>}
          <View style={{flex:1,alignItems:'flex-end',gap:4}}><Text style={{color:colors.ink,fontWeight:'700',fontSize:14}}>{publicName}</Text><Text style={{color:colors.muted,fontSize:12,writingDirection:'ltr'}}>@{profile.username}</Text></View>
          <Pressable accessibilityLabel="عرض الملف العام" oasisKind="plain" onPress={openPublicProfile} style={{padding:10}}><Eye size={19} color={colors.primary}/></Pressable>
        </View>}

        {tab === 'profile' ? (
          <View style={styles.stack} onLayout={event => {
            if (editing && !editorScrolled.current) {
              editorScrolled.current = true;
              scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 10), animated: true });
            }
            if (!editing) editorScrolled.current = false;
          }}>
            {editing ? (
              <ProfileEditor
                draft={draft}
                dirty={dirty}
                saving={saving}
                avatarBusy={avatarBusy}
                coverBusy={coverBusy}
                onChange={patch => {
                  if (patch.displayName !== undefined) setDisplayName(patch.displayName);
                  if (patch.username !== undefined) setUsername(patch.username);
                  if (patch.bio !== undefined) setBio(patch.bio);
                }}
                onSave={() => void saveProfile()}
                onCancel={closeEditor}
                onAvatar={() => void pickAvatar()}
                onCover={() => void pickCover()}
              />
            ) : (
              <View style={styles.profileActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="مشاركة ملفي" style={styles.profileAction} onPress={() => void shareProfile()}>
                  <Users size={18} color={colors.primary} />
                  <Text style={styles.profileActionText}>مشاركة الملف</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="معاينة ملفي العام" style={styles.profileAction} onPress={openPublicProfile}>
                  <Eye size={18} color={colors.primary} />
                  <Text style={styles.profileActionText}>معاينة الملف</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {tab === 'verification' ? (
          <View style={styles.stack}>
            <View style={styles.areaLead}>
              <View style={styles.areaLeadIcon}><ShieldCheck size={22} color={colors.primary} /></View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.areaLeadTitle}>مركز توثيق حسابك</Text>
                <Text style={styles.areaLeadDescription}>الصفة المهنية والوثائق الرسمية في مكان واحد. لا يُمنح أي اعتماد قبل مراجعة الإدارة.</Text>
              </View>
            </View>
            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>هوية الحساب والتوثيق</Text>
                  <Text style={styles.sectionSub}>نوع الحساب والتوثيق منفصلان، ولا تتغير الصفة العامة حتى تعتمدها الإدارة</Text>
                </View>
              </View>

              <View style={styles.identitySummary}>
                <View style={styles.identitySummaryCopy}>
                  <Text style={styles.identityCurrent}>{identityMeta.publicTitle}</Text>
                  <Text style={styles.identityDescription}>{profile.freelance_trade || identityMeta.description}</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: verificationPending ? OASIS.colors.warningSoft : profile.is_verified ? identityMeta.softColor : OASIS.colors.background }]}>

                  <Text style={[styles.statusChipText, { color: verificationPending ? '#B45309' : profile.is_verified ? identityMeta.color : OASIS.colors.muted }]}>
                    {verificationPending ? 'طلب الحساب قيد المراجعة' : profile.is_verified ? 'حساب معتمد سابقًا' : 'الحساب غير موثّق'}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.identityManage} onPress={() => setIdentityOpen((value) => !value)}>
                <Text style={styles.identityManageText}>{identityOpen ? 'إغلاق إدارة الهوية' : 'تغيير نوع الحساب أو طلب التوثيق'}</Text>
                <ChevronLeft size={16} color={OASIS.colors.primary} />
              </Pressable>

              {identityOpen ? (
                <View style={styles.identityEditor}>
                  <Text style={styles.sectionSub}>اختر نوع الحساب لعرض متطلبات التوثيق الخاصة به فقط.</Text>
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

                  <View style={styles.identityFormHeading}>
                    <Text style={styles.identityCurrent}>{ACCOUNT_TYPES.find(type => type.key === identityType)?.label}</Text>
                    <Text style={styles.identityDescription}>
                      {identityType === 'merchant'
                        ? 'التحقق من بيانات المنشأة وسجلها التجاري.'
                        : identityType === 'freelance'
                        ? 'التحقق من وثيقة العمل الحر من منصة العمل الحر.'
                        : identityType === 'standard'
                        ? 'طلب توثيق الحساب الشخصي بالمراجعة الإدارية.'
                        : 'إثبات صفة الحساب المهنية أو المجتمعية.'}
                    </Text>
                  </View>
                  {(identityType === 'merchant' || identityType === 'freelance') ? (
                    <OfficialDocumentVerification key={identityType} kind={identityType === 'merchant' ? 'business' : 'freelance'} userId={userId} />
                  ) : (
                    <View style={styles.identityEditor}>
                      {identityType !== 'standard' ? (
                        <Field
                          label={identityType === 'idea' ? 'اسم المبادرة أو المشروع' : 'اسم النشاط أو الخدمة'}
                          value={professionalName}
                          onChangeText={setProfessionalName}
                          placeholder={identityType === 'idea' ? 'مثال: مبادرة أهل الحي' : 'مثال: صيانة الأجهزة المنزلية'}
                        />
                      ) : null}
                      <Pressable oasisKind="action" style={styles.evidenceButton} onPress={() => void chooseEvidence()}>
                        <Package size={16} color={colors.primary} />
                        <View style={styles.evidenceCopy}>
                          <Text style={styles.evidenceTitle}>{evidence ? 'تم اختيار الإثبات' : 'رفع إثبات الصفة'}</Text>
                          <Text style={styles.evidenceSub}>{evidence?.fileName || 'الصورة خاصة بفريق المراجعة وليست عامة'}</Text>
                        </View>
                      </Pressable>
                      <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryButton} onPress={() => void submitIdentityRequest()} disabled={identitySaving || verificationPending}>
                        {identitySaving ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <ShieldCheck size={16} color={OASIS.colors.surface} />}
                        <Text style={styles.primaryButtonText}>{verificationPending ? 'بانتظار مراجعة الإدارة' : 'إرسال طلب توثيق هذا النوع'}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : null}
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
                  <QuickAction label="منشأتي" sub="فتح إعدادات وبيانات المنشأة" Icon={Store} onPress={() => setBusinessEditing(current => !current)} />
                ) : (
                  <QuickAction label="تحويل لتجاري" sub="اطلب اعتماد منشأة" Icon={BriefcaseBusiness} onPress={() => { navigateTab('verification'); setIdentityType('merchant'); setIdentityOpen(true); }} />
                )}
                <QuickAction label="المفضلة" sub="كل ما حفظته" Icon={Heart} onPress={() => router.push('/favorites')} />
              </View>
            </SectionCard>

            {business && capabilities.can_manage_business ? (
              <SectionCard>
                <Pressable accessibilityRole="button" accessibilityLabel="عرض تفاصيل منشأتي" accessibilityState={{ expanded: businessEditing }} style={styles.sectionHeader} onPress={() => setBusinessEditing(value => !value)}>
                  <View style={styles.sectionHeaderCopy}>
                    <Text style={styles.sectionTitle}>منشأتي · {business.name || 'النشاط التجاري'}</Text>
                    <Text style={styles.sectionSub}>بيانات المنشأة وتعديلها عند الحاجة</Text>
                  </View>
                  <View style={styles.areaLeadIcon}><Store size={19} color={colors.primary} /></View>
                  <ChevronLeft size={17} color={colors.muted} style={{ transform: [{ rotate: businessEditing ? '90deg' : '0deg' }] }} />
                </Pressable>
                {businessEditing ? <View style={styles.formStack}>
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
                </View> : (
                  <View style={[styles.businessSummary, { backgroundColor: colors.background }]}>
                    <Text numberOfLines={2} style={styles.businessSummaryTitle}>{business.name || 'منشأة حيّنا'}</Text>
                    <Text numberOfLines={2} style={styles.businessSummarySub}>{business.description || 'اضغط على عنوان المنشأة لعرض البيانات وتعديلها.'}</Text>
                  </View>
                )}
              </SectionCard>
            ) : null}

            <SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>محتواي</Text>
                  <Text style={styles.sectionSub}>{totalOwned} عنصر محمّل من {contentTotals.products+contentTotals.services+contentTotals.questions+contentTotals.requests} عنصر</Text>
                </View>
                <Package size={20} color={OASIS.colors.muted} />
              </View>

              <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
              {contentRemaining > 0 && <Pressable oasisKind="action" disabled={contentBusy} onPress={() => void loadMoreContent('all')} style={styles.outlineButtonWide}>{contentBusy ? <ActivityIndicator color={colors.primary}/> : <RefreshCw size={16} color={colors.primary}/>}<Text style={{color:colors.primary}}>{contentBusy ? 'جارٍ التحميل…' : 'تحميل المزيد من محتواي'}</Text></Pressable>}
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
            <View style={styles.areaLead}>
              <View style={styles.areaLeadIcon}><Settings size={22} color={colors.primary} /></View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.areaLeadTitle}>{settingsDetailOpen ? SETTINGS_SECTIONS.find(item => item.id === settingsSection)?.label : 'إعدادات حسابي'}</Text>
                <Text style={styles.areaLeadDescription}>{settingsDetailOpen ? SETTINGS_SECTIONS.find(item => item.id === settingsSection)?.description : 'اختر القسم المطلوب. كل إعداداتك محفوظة في مكانها، بعيدًا عن ملفك العام.'}</Text>
              </View>
            </View>
            {settingsDetailOpen ? (
              <View style={styles.stack}>
                <Pressable accessibilityRole="button" accessibilityLabel="العودة إلى أقسام الإعدادات" style={styles.settingsBack} onPress={() => {
                  setSettingsDetailOpen(false);
                  router.setParams({ tab: 'settings', section: undefined });
                }}>
                  <ChevronLeft size={17} color={colors.primary} style={{ transform: [{ rotate: '180deg' }] }} />
                  <Text style={styles.settingsBackText}>كل الإعدادات</Text>
                </Pressable>
            {settingsSection === 'privacy' && <>
<SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>الخصوصية والتواصل</Text>
                  <Text style={styles.sectionSub}>تحكم بمن يشاهد حسابك ويتواصل معك</Text>
                </View>
                <Lock size={20} color="#0F766E" />
              </View>

              <ProfileContactSettings userId={userId} restricted={profile.profile_privacy === 'private' || Boolean(profile.hide_name) || Boolean(profile.is_banned)} onSaved={message => notify('رقم التواصل', message)} />
              <ToggleRow title="حساب خاص" sub="لا يظهر نشاطك لغير المتابعين" disabled={settingsSaving} value={profile.profile_privacy === 'private'} onValueChange={(value: boolean) => void savePrivacy({ profile_privacy: value ? 'private' : 'public' })} />
              <ToggleRow title="إخفاء الاسم" sub="يظهر الحساب كجار مجهول في السياقات العامة" disabled={settingsSaving} value={Boolean(profile.hide_name)} onValueChange={(value: boolean) => void savePrivacy({ hide_name: value })} />

              <ChoiceGroup
                disabled={settingsSaving}
                label="الرسائل الخاصة"
                value={profile.allow_dms || 'everyone'}
                options={[['everyone','الجميع'],['followers','المتابعون'],['nobody','إيقاف الخاص']]}
                onChange={(value: string) => void savePrivacy({ allow_dms: value })}
              />
              <ChoiceGroup
                disabled={settingsSaving}
                label="الرد على القصص"
                value={profile.allow_story_replies || 'everyone'}
                options={[['everyone','الجميع'],['followers','المتابعون'],['nobody','إيقاف الردود']]}
                onChange={(value: string) => void savePrivacy({ allow_story_replies: value })}
              />
            </SectionCard></>}

            {settingsSection === 'location' && (
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
            )}

            {settingsSection === 'notifications' && <>
<SectionCard>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>الإشعارات والهدوء</Text>
                  <Text style={styles.sectionSub}>تنبيهات الجهاز وفترة عدم الإزعاج</Text>
                </View>
                {pushEnabled ? <Bell size={20} color={OASIS.colors.primary} /> : <BellOff size={20} color={OASIS.colors.muted} />}
              </View>

              <ToggleRow title="إشعارات الجهاز" sub={pushEnabled ? 'التنبيهات مفعلة على هذا الجهاز' : 'فعّل تنبيهات الرسائل والأحداث المهمة'} value={pushEnabled} onValueChange={() => void togglePush()} disabled={pushBusy} />
              <ToggleRow title="عدم الإزعاج" sub="إيقاف التنبيهات خلال الفترة المحددة" disabled={settingsSaving} value={Boolean(dnd.enabled)} onValueChange={(value: boolean) => void saveDndSettings(value)} />
              <View style={styles.twoFields}>
                <View style={styles.flexField}><Field label="من" value={dndStart} onChangeText={setDndStart} placeholder="22:00" /></View>
                <View style={styles.flexField}><Field label="إلى" value={dndEnd} onChangeText={setDndEnd} placeholder="07:00" /></View>
              </View>
              <Pressable disabled={settingsSaving} style={styles.outlineButtonWide} onPress={() => void saveDndSettings(Boolean(dnd.enabled), dndStart, dndEnd)}>
                <Save size={15} color="#0F766E" />
                <Text style={styles.outlineButtonText}>حفظ فترة الهدوء</Text>
              </Pressable>
            </SectionCard></>}

            {settingsSection === 'appearance' && <AppearanceSettings onProfileDesign={() => {setSettingsSection('design');router.setParams({tab:'settings',section:'design'});}} />}

            {settingsSection === 'design' && <>
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

            <Text accessibilityRole="alert" style={{color:designStatus === 'error' ? colors.danger : colors.muted,textAlign:'right',fontSize:12}}>{designStatus === 'saving' ? 'جارٍ حفظ التخصيص…' : designStatus === 'saved' ? 'تم حفظ التخصيص' : designStatus === 'error' ? designError : 'يُحفظ التخصيص تلقائيًا في ملفك العام'}</Text>
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
              featuredBusy={featuredSaving}
              wide={false}
              onPickCover={() => void pickCover()}
              onRemoveCover={() => void removeCover()}
              onChange={(patch) => void saveCustomization(patch)}
              onToggleFeatured={(type, id) => void toggleFeatured(type, id)}
              onSaveFeaturedTitle={(title) => void saveCustomization({ featured_title: title })}
              onReset={() => void resetDesign()}
            />
            {contentRemaining > 0 && <Pressable oasisKind="action" disabled={contentBusy} onPress={() => void loadMoreContent('all')}><Text style={{color:colors.primary}}>{contentBusy ? 'جارٍ التحميل…' : 'تحميل مزيد من المحتوى لاختيار أعمال مميزة'}</Text></Pressable>}
            </>}

            {settingsSection === 'security' && <>
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
            </SectionCard></>}

            {settingsSection === 'blocked' && <>
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
            </SectionCard></>}

            {settingsSection === 'help' && <>
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

</>}
{settingsSection === 'account' && <>
<SectionCard>
              <Pressable oasisKind="action" oasisVariant="danger" style={styles.signOutButton} disabled={settingsSaving} onPress={() => {setSettingsSaving(true);void supabase.auth.signOut().then(result => {if (result.error) notify('تعذر تسجيل الخروج',result.error.message);else router.replace('/auth');}).catch(error => notify('تعذر تسجيل الخروج',error?.message || 'حاول مرة أخرى.')).finally(() => setSettingsSaving(false));}}>
                <LogOut size={17} color={OASIS.colors.danger} />
                <Text style={styles.signOutText}>تسجيل الخروج</Text>
              </Pressable>
              <Pressable oasisKind="action" oasisVariant="danger" style={styles.deleteButton} onPress={confirmDeleteAccount}>
                <Trash2 size={17} color={OASIS.colors.danger} />
                <Text style={styles.deleteText}>حذف الحساب نهائيًا</Text>
              </Pressable>
            </SectionCard>
            </>}
              </View>
            ) : (
              <View style={styles.stack}>
                {SETTINGS_GROUPS.map(group => (
                  <SectionCard key={group.title}>
                    <View style={styles.sectionHeaderCopy}>
                      <Text style={styles.sectionTitle}>{group.title}</Text>
                      <Text style={styles.sectionSub}>{group.subtitle}</Text>
                    </View>
                    <View style={styles.settingsList}>
                      {group.ids.map((id, index) => {
                        const item = SETTINGS_SECTIONS.find(section => section.id === id);
                        if (!item) return null;
                        const Icon = item.Icon;
                        return (
                          <Pressable
                            key={id}
                            accessibilityRole="button"
                            accessibilityLabel={'فتح ' + item.label}
                            style={[styles.settingsListItem, index > 0 && styles.settingsListDivider]}
                            onPress={() => {
                              setSettingsSection(id);
                              setSettingsDetailOpen(true);
                              designScrolled.current = false;
                              router.setParams({ tab: 'settings', section: id });
                              scrollRef.current?.scrollTo({ y: 0, animated: true });
                            }}
                          >
                            <View style={styles.settingsListIcon}><Icon size={19} color={colors.primary} /></View>
                            <View style={styles.settingsListCopy}>
                              <Text style={styles.settingsListTitle}>{item.label}</Text>
                              <Text style={styles.settingsListSubtitle} numberOfLines={1}>{item.description}</Text>
                            </View>
                            <ChevronLeft size={17} color={colors.muted} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </SectionCard>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return <OasisSurface oasisSurface="card" style={styles.card}>{children}</OasisSurface>;
}

function Stat({ value, label }: { value: number; label: string }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value > 999 ? '999+' : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HubTabButton({ active, label, Icon, onPress }: { active: boolean; label: string; Icon: any; onPress: () => void }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <Pressable oasisKind="plain" accessibilityRole="tab" accessibilityState={{selected:active}} style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Icon size={17} color={active ? colors.primary : colors.muted} />
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field(props: any) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  const { label, multiline, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        multiline={multiline}
        textAlign="right"
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function ToggleRow({ title, sub, value, onValueChange, disabled }: any) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        value={Boolean(value)}
        onValueChange={onValueChange}
        trackColor={{ false: OASIS.colors.line, true: '#A7F3D0' }}
        thumbColor={value ? OASIS.colors.primary : '#94A3B8'}
      />
    </View>
  );
}

function ChoiceGroup({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[][]; onChange: (value: string) => void; disabled?:boolean }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <View style={styles.choiceWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([id, title]) => (
          <Pressable key={id} disabled={disabled} accessibilityRole="radio" accessibilityState={{checked:value===id}} style={[styles.choice, value === id && styles.choiceActive]} onPress={() => onChange(id)}>
            <Text style={[styles.choiceText, value === id && styles.choiceTextActive]}>{title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function QuickAction({ label, sub, Icon, onPress, disabled }: any) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <Pressable accessibilityRole="button" disabled={Boolean(disabled)} style={[styles.quickAction, disabled && styles.quickActionDisabled]} onPress={onPress}>
      <View style={styles.quickActionIcon}><Icon size={20} color={disabled ? '#94A3B8' : OASIS.colors.primary} /></View>
      <View style={styles.quickActionCopy}><Text style={styles.quickActionTitle}>{label}</Text><Text style={styles.quickActionSub}>{sub}</Text></View>
      <ChevronLeft size={17} color="#94A3B8" />
    </Pressable>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  return (
    <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip" style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function OwnedRow({ kind, item, onPress }: { kind: string; item: any; onPress: () => void }) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
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

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  loadingText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  headerAction: { width: 36, height: 36, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 14, paddingTop: 14, gap: 16, maxWidth: 920, width: '100%', alignSelf: 'center' },
  profileHero: { borderWidth: 1, borderColor: colors.line, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, minHeight: 138, borderRadius: 18, overflow: 'hidden' },
  profileHeroWide: { minHeight: 156, padding: 20 },
  heroCoverButton: { position: 'absolute', left: 12, top: 12, minHeight: 32, borderRadius: 10, paddingHorizontal: 9, backgroundColor: 'rgba(0,0,0,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, zIndex: 3 },
  heroCoverButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, position: 'relative', borderWidth: 3, borderColor: colors.soft },
  avatar: { width: '100%', height: '100%', borderRadius: 40 },
  avatarFallback: { flex: 1, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  avatarLetter: { fontSize: 31, color: colors.primary, fontWeight: '700' },
  cameraBadge: { position: 'absolute', left: -2, bottom: -2, width: 27, height: 27, borderRadius: 14, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  identityIcon: { position: 'absolute', right: -4, top: -4 },
  heroCopy: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
  publicName: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', textAlign: 'right', maxWidth: '100%' },
  handle: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  badgeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  locationLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 7 },
  locationText: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700' },
  statsBar: { flexDirection: 'row-reverse', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 11, borderLeftWidth: 1, borderLeftColor: '#F1F5F9' },
  statValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  tabs: { flexDirection:'row-reverse',backgroundColor:colors.surface,borderRadius:18,padding:5,borderWidth:1,borderColor:colors.line,gap:4 },
  tabButton: { flex: 1, minWidth: 0, minHeight: 49, borderRadius: 13, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabButtonActive: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.primary + '36' },
  tabButtonText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  tabButtonTextActive: { color: colors.primary },
  stack: { gap: 14 },
  businessSummary: { borderRadius: 14, padding: 14, gap: 5 },
  businessSummaryTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  businessSummarySub: { color: colors.muted, fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
  profileActions: { flexDirection: 'row-reverse', gap: 10 },
  profileAction: { flex: 1, minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface },
  profileActionText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  areaLead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16 },
  areaLeadIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  areaLeadTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  areaLeadDescription: { color: colors.muted, fontSize: 11.5, lineHeight: 19, textAlign: 'right' },
  settingsList: { gap: 0 },
  settingsListItem: { flexDirection: 'row-reverse', minHeight: 65, alignItems: 'center', gap: 11, paddingVertical: 9 },
  settingsListDivider: { borderTopWidth: 1, borderColor: colors.line },
  settingsListIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.soft },
  settingsListCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  settingsListTitle: { color: colors.ink, fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  settingsListSubtitle: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  settingsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  settingsCategory: { flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: 156, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, alignItems: 'flex-end', gap: 8 },
  settingsCategoryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  settingsCategoryTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  settingsCategoryDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', minHeight: 35 },
  settingsBack: { alignSelf: 'flex-end', minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.soft },
  settingsBackText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 12 },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionHeaderCopy: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  sectionSub: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  ghostButton: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F1F5F9' },
  ghostButtonText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  bio: { color: colors.ink, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  rowActions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  outlineButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.soft, backgroundColor: colors.soft, paddingHorizontal: 11, minHeight: 38, borderRadius: 11 },
  outlineButtonWide: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.soft, backgroundColor: colors.soft, paddingHorizontal: 11, minHeight: 42, borderRadius: 12 },
  outlineButtonText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  formStack: { gap: 10 },
  fieldWrap: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 43, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 11, color: colors.ink, fontSize: 12, fontWeight: '700' },
  inputMultiline: { minHeight: 86, textAlignVertical: 'top', paddingTop: 10 },
  primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: colors.surface, fontSize: 12, fontWeight: '700' },
  identitySquare: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  identitySummary: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 14, padding: 11 },
  identitySummaryCopy: { flex: 1, alignItems: 'flex-end' },
  identityCurrent: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  identityDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', marginTop: 2 },
  statusChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  identityManage: { minHeight: 42, borderRadius: 12, backgroundColor: colors.soft, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  identityManageText: { color: colors.primary, fontSize: 11.5, fontWeight: '700' },
  identityEditor: { gap: 11, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 11 },
  identityFormHeading: { gap: 5, alignItems: 'flex-end', paddingVertical: 7, borderTopWidth: 1, borderColor: colors.line },
  typeGrid: { gap: 7 },
  typeChoice: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 9 },
  typeChoiceIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeChoiceCopy: { flex: 1, alignItems: 'flex-end' },
  typeChoiceTitle: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
  typeChoiceSub: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  evidenceButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 44, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7F3D0', backgroundColor: colors.soft, borderRadius: 13, padding: 10 },
  evidenceCopy: { flex: 1, alignItems: 'flex-end' },
  evidenceTitle: { color: colors.primary, fontSize: 11.5, fontWeight: '700' },
  evidenceSub: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  locationCard: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.background, padding: 11, borderRadius: 13 },
  locationMain: { flex: 1, color: colors.ink, fontSize: 11.5, fontWeight: '600', textAlign: 'right' },
  smallButton: { minHeight: 34, borderRadius: 10, backgroundColor: colors.soft, paddingHorizontal: 9, flexDirection: 'row-reverse', gap: 5, alignItems: 'center' },
  smallButtonText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  actionGrid: { gap: 8 },
  quickAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 10 },
  quickActionDisabled: { opacity: 0.58, backgroundColor: colors.background },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  quickActionCopy: { flex: 1, alignItems: 'flex-end' },
  quickActionTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  quickActionSub: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  twoFields: { flexDirection: 'row-reverse', gap: 8 },
  flexField: { flex: 1 },
  filterRow: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 2 },
  filterChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#F1F5F9' },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: colors.surface },
  contentList: { gap: 7 },
  ownedRow: { minHeight: 56, borderRadius: 13, borderWidth: 1, borderColor: '#EDF2F7', padding: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  ownedThumb: { width: 43, height: 43, borderRadius: 11, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ownedImage: { width: '100%', height: '100%' },
  ownedCopy: { flex: 1, alignItems: 'flex-end' },
  ownedType: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  ownedTitle: { color: colors.ink, fontSize: 11.5, fontWeight: '700', marginTop: 1, textAlign: 'right' },
  ownedStatus: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 11, textAlign: 'center', lineHeight: 18 },
  navigationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minHeight: 52 },
  navigationIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navigationCopy: { flex: 1, alignItems: 'flex-end' },
  navigationTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  navigationSub: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'right' },
  toggleRow: { minHeight: 56, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 5 },
  toggleCopy: { flex: 1, alignItems: 'flex-end' },
  toggleTitle: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
  toggleSub: { color: colors.muted, fontSize: 11, marginTop: 2, lineHeight: 17, textAlign: 'right' },
  choiceWrap: { gap: 6, paddingTop: 4 },
  choiceRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  choice: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F1F5F9' },
  choiceActive: { backgroundColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  choiceTextActive: { color: colors.surface },
  colorRow: { flexDirection: 'row-reverse', gap: 9, flexWrap: 'wrap' },
  colorDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  colorDotActive: { borderColor: colors.ink },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 2 },
  blockedRow: { minHeight: 54, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  blockedAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blockedAvatarImage: { width: '100%', height: '100%' },
  blockedCopy: { flex: 1, alignItems: 'flex-end' },
  blockedName: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  blockedHandle: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  unblockButton: { borderRadius: 9, backgroundColor: colors.dangerSoft, paddingHorizontal: 9, paddingVertical: 6 },
  unblockText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  signOutButton: { minHeight: 45, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.dangerSoft },
  signOutText: { color: colors.danger, fontSize: 11.5, fontWeight: '700' },
  deleteButton: { minHeight: 45, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#FECACA' },
  deleteText: { color: colors.danger, fontSize: 11.5, fontWeight: '700' },
});

const settingsStyles=StyleSheet.create({intro:{alignItems:'flex-end',gap:6,paddingVertical:12},heading:{fontSize:24,fontWeight:'800'},layout:{gap:20},navigation:{gap:5,borderWidth:1,borderColor:OASIS.colors.line,borderRadius:18,padding:8,backgroundColor:OASIS.colors.surface},navigationItem:{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:13,borderRadius:12,borderWidth:1,borderColor:'transparent'}});

const accountStyles=StyleSheet.create({accountContext:{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:16,borderWidth:1,borderRadius:18},notice:{padding:16,borderWidth:1,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',gap:12},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',alignItems:'center',padding:24},dialog:{width:'100%',maxWidth:440,borderRadius:24,padding:24,gap:18}});
