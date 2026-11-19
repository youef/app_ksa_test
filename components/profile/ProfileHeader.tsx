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
  const action = (label: string, Icon: typeof Edit3, onPress?: () => void) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} disabled={!onPress} onPress={onPress} style={button}><Icon size={16} color={colors.ink} /><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 11.5 }}>{label}</Text></Pressable>;

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
    <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { height: width < 600 ? 122 : 168 }]}>
      {!anonymous && !locked && props.coverUri && !coverFailed && <Image source={{ uri: props.coverUri }} style={[StyleSheet.absoluteFillObject, styles.coverImage]} resizeMode="cover" onError={() => setCoverFailed(true)} />}
      <View style={styles.glow} />
      {!anonymous && !locked && !coverFailed && props.onCoverPreview && <Pressable accessibilityRole="button" accessibilityLabel="عرض صورة الغلاف" onPress={props.onCoverPreview} style={StyleSheet.absoluteFillObject}/>}
      {own && <Pressable accessibilityRole="button" accessibilityLabel="تغيير صورة الغلاف" disabled={props.coverBusy} style={styles.coverButton} onPress={props.onCoverPress || props.onDesign}>{props.coverBusy ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={14} color="#fff" />}<Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>تعديل الغلاف</Text></Pressable>}
    </LinearGradient>
    <View style={[styles.body, width < 600 && styles.bodyCompact]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={props.editableAvatar ? 'تغيير الصورة الشخصية' : props.hasStories && !props.onStoriesPress ? 'عرض اليوميات النشطة' : 'الصورة الشخصية'}
          disabled={props.avatarBusy || !props.onAvatarPress || anonymous || locked}
          onPress={props.onAvatarPress}
          style={[styles.avatarFrame, { backgroundColor: colors.surface, borderColor: props.hasStories ? accent : colors.surface }]}>
          {profile.avatar_url && !anonymous && !avatarFailed && !profile.avatar_url.includes('blank-profile-picture')
            ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} onError={() => setAvatarFailed(true)} />
            : <View style={[styles.avatar, { backgroundColor: colors.soft, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: accent, fontSize: 24, fontWeight: '800' }}>{name[0]?.toUpperCase()}</Text></View>}
          {props.avatarBusy && <View style={[StyleSheet.absoluteFillObject, styles.avatarLoading]}><ActivityIndicator color="#fff" /></View>}
          {props.editableAvatar && <View style={[styles.camera, { backgroundColor: accent, borderColor: colors.surface }]}><Camera size={11} color="#fff" /></View>}
        </Pressable>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text numberOfLines={2} style={[styles.name, { color: colors.ink }]}>{name}</Text>
            {!anonymous && customization?.show_badges !== false && <AccountStatusMark role={profile.role} accountType={profile.account_type} isVerified={Boolean(profile.is_verified)} size={17} />}
            {profile.profile_privacy === 'private' && <Lock size={15} color={colors.muted} />}
          </View>
          {!anonymous && <Text numberOfLines={1} style={[styles.handle, { color: colors.muted }]}>@{profile.username}</Text>}
          {props.followedBy && !own && <Text style={[styles.followedBy, { color: colors.primary, backgroundColor: colors.soft }]}>يتابعك</Text>}
        </View>
      </View>
      {(own || !props.hideContactActions || (!locked && props.hasStories && props.onStoriesPress)) && (
        <View style={styles.actions}>
          {own ? <>
            {action('تعديل ملفي', Edit3, props.onEdit)}
            <Pressable accessibilityRole="button" accessibilityLabel="تخصيص المظهر" hitSlop={6} disabled={!props.onDesign} onPress={props.onDesign}
              style={[button, styles.iconButton]}><Palette size={17} color={colors.primary} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="إعدادات الحساب" hitSlop={6} disabled={!props.onSettings} onPress={props.onSettings}
              style={[button, styles.iconButton]}><Settings size={17} color={colors.primary} /></Pressable>
          </> : props.hideContactActions ? null : <>
            <Pressable accessibilityRole="button" disabled={props.busy || (locked && profile.is_banned === true)}
              onPress={props.onFollow} style={[button, { backgroundColor: props.following ? colors.surface : accent }]}>
              <Text style={{ color: props.following ? colors.ink : '#fff', fontWeight: '700', fontSize: 12 }}>{props.following ? 'تتابعه' : 'متابعة'}</Text>
            </Pressable>
            {props.canMessage !== false && props.onMessage && <Pressable accessibilityRole="button" accessibilityLabel="مراسلة"
              disabled={props.busy || profile.is_banned === true} onPress={props.onMessage} style={button}>
              <MessageCircle size={17} color={colors.primary} /><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>مراسلة</Text>
            </Pressable>}
          </>}
          {!locked && props.hasStories && props.onStoriesPress && action('اليوميات', CirclePlay, props.onStoriesPress)}
        </View>
      )}
      <View style={styles.details}>
        {!locked && profile.bio && customization?.section_visibility?.bio !== false && <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 26, textAlign: 'right', marginVertical: 4 }}>{profile.bio}</Text>}
        {!anonymous && !locked && !profile.is_banned && !props.hideContactActions && !!props.contactPhone && <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <Pressable accessibilityRole="link" accessibilityLabel="الاتصال برقم التواصل" disabled={calling} onPress={() => void callContact()} style={button}>{calling ? <ActivityIndicator color={colors.primary} /> : <Phone size={17} color={colors.primary} />}<Text style={{ color: colors.primary, fontWeight: '700', writingDirection: 'ltr' }}>{props.contactPhone}</Text></Pressable>
          {!!callError && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, textAlign: 'right' }}>{callError}</Text>}
        </View>}
        {!anonymous && <View style={styles.metadata}>
          <View style={styles.row}><MapPin size={14} color={colors.muted} /><Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>{[profile.district && (/^حي\s/.test(profile.district) ? profile.district : 'حي ' + profile.district), profile.city].filter(Boolean).join('، ') || 'المملكة العربية السعودية'}</Text></View>
          {!!profile.created_at && <View style={styles.row}><CalendarDays size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 11 }}>انضم {new Date(profile.created_at).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}</Text></View>}
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
        {!locked && customization?.show_stats !== false && <Text style={[styles.reputation, { color: colors.muted }]}>{stats.reputation.toLocaleString('ar-SA')} نقطة سمعة{profile.is_geoverified ? ' · تم تأكيد الحي' : ''}</Text>}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 17, overflow: 'hidden', borderWidth: 1 },
  cover: { overflow: 'hidden' },
  coverImage: { opacity: 0.34 },
  glow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -85, right: -20 },
  coverButton: { position: 'absolute', left: 12, top: 11, minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 10, backgroundColor: 'rgba(5,22,16,0.56)' },
  body: { paddingHorizontal: 18, paddingBottom: 14 },
  bodyCompact: { paddingHorizontal: 13, paddingBottom: 13 },
  top: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, marginBottom: 5 },
  avatarFrame: { marginTop: -37, width: 82, height: 82, borderRadius: 41, padding: 2, borderWidth: 2 },
  avatar: { width: 74, height: 74, borderRadius: 37 },
  avatarLoading: { backgroundColor: 'rgba(0,0,0,.38)', borderRadius: 41, alignItems: 'center', justifyContent: 'center' },
  camera: { position: 'absolute', left: -3, bottom: -1, borderWidth: 2, borderRadius: 12, padding: 5 },
  identity: { flex: 1, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center', gap: 2, paddingTop: 6 },
  nameRow: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  name: { fontSize: 18, lineHeight: 25, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  handle: { fontSize: 11.5, fontWeight: '600', textAlign: 'right', writingDirection: 'ltr' },
  followedBy: { fontSize: 10.5, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 10 },
  button: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconButton: { width: 44, paddingHorizontal: 0 },
  details: { alignItems: 'flex-end', gap: 8 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metadata: { width: '100%', flexDirection: 'row-reverse', flexWrap: 'wrap', columnGap: 13, rowGap: 6, marginTop: 1 },
  stats: { width: '100%', flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 13, paddingVertical: 2, marginTop: 3 },
  stat: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 5 },
  statValue: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
  statLabel: { fontSize: 10.5, lineHeight: 15, fontWeight: '600' },
  statDivider: { width: 1, height: 27 },
  reputation: { fontSize: 10.5, lineHeight: 16, marginTop: 1, textAlign: 'right' },
});
