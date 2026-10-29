import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, Camera, CirclePlay, Edit3, Lock, MapPin, MessageCircle, Palette, Phone, Settings } from 'lucide-react-native';
import { normalizeContactPhone } from '@/lib/contactPhone';
import { loadProfileContact } from '@/lib/profileContact';
import { useTheme } from '@/context/ThemeContext';
import { bannerColors } from '@/lib/profileTheme';
import { AccountStatusMark, getAccountIdentityMeta } from './AccountIdentityBadge';

type Props = {
  profile: any;
  contactPhone?: string;
  customization?: any;
  coverUri: string;
  displayName?: string;
  stats: { followers: number; following: number; contributions: number; reputation: number };
  own?: boolean;
  anonymous?: boolean;
  locked?: boolean;
  following?: boolean;
  followedBy?: boolean;
  busy?: boolean;
  hideContactActions?: boolean;
  canMessage?: boolean;
  avatarBusy?: boolean;
  coverBusy?: boolean;
  hasStories?: boolean;
  editableAvatar?: boolean;
  onAvatarPress?: () => void;
  onCoverPress?: () => void;
  onCoverPreview?: () => void;
  onEdit?: () => void;
  onDesign?: () => void;
  onSettings?: () => void;
  onFollowers?: () => void;
  onFollowing?: () => void;
  onFollow?: () => void;
  onMessage?: () => void;
  onStoriesPress?: () => void;
};

/** Shared by the public profile and account editor so their appearance stays in sync. */
export function ProfileHeader(props: Props) {
  const { profile, customization, stats, own, anonymous, locked } = props;
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [coverFailed, setCoverFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState('');
  useEffect(() => { setCallError(''); }, [profile.id, props.contactPhone]);
  useEffect(() => setCoverFailed(false), [props.coverUri]);
  useEffect(() => setAvatarFailed(false), [profile.avatar_url]);
  const identity = getAccountIdentityMeta(profile.role, profile.account_type, Boolean(profile.is_verified));
  const accent = customization?.accent_color || identity.color;
  const name = anonymous ? 'جار مجهول' : props.displayName || profile.display_name || profile.username || 'جار';
  const heroColors = !customization?.banner_style || customization.banner_style === 'emerald' ? identity.heroColors : bannerColors(customization.banner_style);
  const button = [styles.button, { backgroundColor: colors.surface, borderColor: colors.line }];
  const action = (label: string, Icon: typeof Edit3, onPress?: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={button}><Icon size={16} color={colors.ink} /><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>{label}</Text></Pressable>;

  async function callContact() {
    if (calling) return;
    setCalling(true); setCallError('');
    try {
      const current = await loadProfileContact(profile.id, true);
      const phone = normalizeContactPhone(current?.phone || '');
      if (!phone || phone !== props.contactPhone) {
        setCallError('رقم التواصل غير متاح حاليًا. حدّث الملف.');
        return;
      }
      await Linking.openURL('tel:' + phone);
    } catch { setCallError('تعذر فتح الاتصال. أعد المحاولة من جهاز يدعم المكالمات.'); }
    finally { setCalling(false); }
  }

  return <View testID="profile-header" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: width < 600 ? 150 : 210, overflow: 'hidden' }}>
      {!anonymous && props.coverUri && !coverFailed && <Image source={{ uri: props.coverUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setCoverFailed(true)} />}
      <View style={styles.glow} />
      {!anonymous && !locked && !coverFailed && props.onCoverPreview && <Pressable accessibilityRole="button" accessibilityLabel="عرض صورة الغلاف" onPress={props.onCoverPreview} style={StyleSheet.absoluteFillObject}/>}
      {own && <Pressable accessibilityRole="button" accessibilityLabel="تغيير صورة الغلاف" disabled={props.coverBusy} style={styles.coverButton} onPress={props.onCoverPress || props.onDesign}>{props.coverBusy ? <ActivityIndicator color="#fff" /> : <Camera size={16} color="#fff" />}<Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>تعديل الغلاف</Text></Pressable>}
    </LinearGradient>
    <View style={[styles.body, width < 600 && styles.bodyCompact]}>
      <View style={[styles.top, width < 380 && styles.topCompact]}>
        <Pressable accessibilityRole="button" accessibilityLabel={props.editableAvatar ? 'تغيير الصورة الشخصية' : props.hasStories && !props.onStoriesPress ? 'عرض اليوميات النشطة' : 'الصورة الشخصية'} disabled={props.avatarBusy || !props.onAvatarPress || anonymous || locked} onPress={props.onAvatarPress} style={[styles.avatarFrame, { backgroundColor: colors.surface, borderColor: props.hasStories ? accent : colors.surface }]}>
          {profile.avatar_url && !anonymous && !avatarFailed && !profile.avatar_url.includes('blank-profile-picture') ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} onError={() => setAvatarFailed(true)} /> : <View style={[styles.avatar, { backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: accent, fontSize: 34, fontWeight: '800' }}>{name[0]?.toUpperCase()}</Text></View>}
          {props.avatarBusy && <View style={[StyleSheet.absoluteFillObject, styles.avatarLoading]}><ActivityIndicator color="#fff" /></View>}
          {props.editableAvatar && <View style={[styles.camera, { backgroundColor: accent, borderColor: colors.surface }]}><Camera size={14} color="#fff" /></View>}
        </Pressable>
        <View style={[styles.actions, width < 380 && styles.actionsCompact]}>
          {own ? <>
            <Pressable accessibilityRole="button" accessibilityLabel="إعدادات الحساب" hitSlop={4} style={[button, { width: width < 600 ? 36 : 44, paddingHorizontal: 0 }]} onPress={props.onSettings}><Settings size={18} color={colors.ink} /></Pressable>
            {action('تعديل ملفي', Edit3, props.onEdit)}
            {width < 600 ? <Pressable accessibilityRole="button" accessibilityLabel="تخصيص" hitSlop={4} onPress={props.onDesign} style={[button,{width:36,paddingHorizontal:0}]}><Palette size={18} color={colors.ink}/></Pressable> : action('تخصيص', Palette, props.onDesign)}
          </> : props.hideContactActions ? null : <>
            <Pressable accessibilityRole="button" disabled={props.busy || locked && profile.is_banned === true} onPress={props.onFollow} style={[button, { backgroundColor: props.following ? colors.surface : accent }]}><Text style={{ color: props.following ? colors.ink : '#fff', fontWeight: '700' }}>{props.following ? 'تتابعه' : 'متابعة'}</Text></Pressable>
            {props.canMessage !== false && props.onMessage && <Pressable accessibilityRole="button" accessibilityLabel="مراسلة" disabled={props.busy || profile.is_banned === true} onPress={props.onMessage} style={button}><MessageCircle size={18} color={colors.ink} /></Pressable>}
          </>}
        </View>
      </View>
      <View style={styles.details}>
        <View style={styles.row}><Text style={[styles.name, { color: colors.ink }]}>{name}</Text>{!anonymous && customization?.show_badges !== false && <AccountStatusMark role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} size={21} />}{profile.profile_privacy === 'private' && <Lock size={17} color={colors.muted} />}</View>
        {!anonymous && <Text style={{ color: colors.muted, fontSize: 15, writingDirection: 'ltr' }}>@{profile.username}</Text>}
        {props.followedBy && !own && <Text style={{ color: colors.muted, backgroundColor: colors.soft, padding: 5, borderRadius: 5, fontSize: 11 }}>يتابعك</Text>}
        {!locked && props.hasStories && props.onStoriesPress && action('عرض اليوميات',CirclePlay,props.onStoriesPress)}
        {!locked && profile.bio && customization?.section_visibility?.bio !== false && <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 26, textAlign: 'right', marginVertical: 4 }}>{profile.bio}</Text>}
        {!anonymous && !locked && !profile.is_banned && !props.hideContactActions && !!props.contactPhone && <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Pressable accessibilityRole="link" accessibilityLabel="الاتصال برقم التواصل" disabled={calling} onPress={() => void callContact()} style={button}>{calling ? <ActivityIndicator color={colors.primary} /> : <Phone size={17} color={colors.primary} />}<Text style={{ color: colors.primary, fontWeight: '700', writingDirection: 'ltr' }}>{props.contactPhone}</Text></Pressable>
          {!!callError && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, textAlign: 'right' }}>{callError}</Text>}
        </View>}
        {!anonymous && <View style={styles.metadata}>
          <View style={styles.row}><MapPin size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>{[profile.district && 'حي ' + profile.district, profile.city].filter(Boolean).join('، ') || 'المملكة العربية السعودية'}</Text></View>
          {!!profile.created_at && <View style={styles.row}><CalendarDays size={15} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>انضم في {new Date(profile.created_at).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</Text></View>}
        </View>}
        {!anonymous && customization?.show_stats !== false && <View style={[styles.stats, { backgroundColor: colors.soft, borderColor: colors.line }]}>
          <Pressable style={styles.stat} accessibilityRole="button" accessibilityLabel="عرض المتابعين" disabled={locked} onPress={props.onFollowers}>
            <Text style={[styles.statValue, { color: colors.ink }]}>{stats.followers.toLocaleString('ar-SA')}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>متابع</Text>
          </Pressable>
          <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
          <Pressable style={styles.stat} accessibilityRole="button" accessibilityLabel="عرض الحسابات التي يتابعها" disabled={locked} onPress={props.onFollowing}>
            <Text style={[styles.statValue, { color: colors.ink }]}>{stats.following.toLocaleString('ar-SA')}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>يتابع</Text>
          </Pressable>
          <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.ink }]}>{stats.contributions.toLocaleString('ar-SA')}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>مساهمة</Text>
          </View>
        </View>}
        {!locked && customization?.show_stats !== false && <Text style={{color:colors.muted,fontSize:12,marginTop:3}}>{stats.reputation.toLocaleString('ar-SA')} نقطة سمعة{profile.is_geoverified ? ' · تم تأكيد الحي' : ''}</Text>}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  body: { paddingHorizontal: 28, paddingBottom: 24 },
  bodyCompact: { paddingHorizontal: 16, paddingBottom: 20 },
  topCompact: { flexWrap: 'wrap', rowGap: 0 },
  actionsCompact: { flexBasis: '100%', paddingTop: 8 },
  top: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  avatarFrame: { marginTop: -52, width: 104, height: 104, borderRadius: 52, padding: 2, borderWidth: 2 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarLoading: { backgroundColor: 'rgba(0,0,0,.4)', borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  identityIcon: { position: 'absolute', right: -4, bottom: -3 },
  camera: { position: 'absolute', left: -3, bottom: 0, borderWidth: 3, borderRadius: 17, padding: 6 },
  actions: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  button: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  details: { alignItems: 'flex-end', gap: 12 },
  name: { fontSize: 25, lineHeight: 36, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metadata: { width: '100%', flexDirection: 'row-reverse', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 4 },
  stats: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingVertical: 6, marginTop: 6 },
  stat: { flex: 1, minWidth: 0, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  statValue: { fontSize: 21, lineHeight: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  statDivider: { width: 1, height: 30 },
  coverButton: { position: 'absolute', left: 16, top: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,.45)', borderRadius: 999, padding: 10 },
  glow: { position: 'absolute', width: 190, height: 190, borderRadius: 100, backgroundColor: 'rgba(16,185,129,.15)', bottom: -100, right: -40 },
});
