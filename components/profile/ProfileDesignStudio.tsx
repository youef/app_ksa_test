import { AccountStatusMark } from '@/components/profile/AccountIdentityBadge';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { OASIS } from '@/lib/oasis';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import {
  PROFILE_ACCENTS,
  PROFILE_BANNERS,
  SECTION_META,
  normalizeSectionVisibility,
  bannerColors,
  accentSoft,
  DEFAULT_FEATURED_TITLE,
  MAX_FEATURED,
  type ProfileSectionKey,
} from '@/lib/profileTheme';
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  MapPin,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';

export type FeaturedType = 'market' | 'service' | 'question' | 'request';

export type FeaturedRow = { item_type: FeaturedType; item_id: string; position?: number };

export type StudioItem = { type: FeaturedType; id: string; title: string; subtitle?: string | null; image?: string | null };

type Stats = { followers: number; following: number; content: number; reputation: number };

type Props = {
  userId: string;
  profile: any;
  customization: any;
  displayName: string;
  stats: Stats;
  coverUri: string;
  coverVisible: boolean;
  coverBusy: boolean;
  items: StudioItem[];
  featured: FeaturedRow[];
  featuredBusy?: boolean;
  wide: boolean;
  onPickCover: () => void;
  onRemoveCover: () => void;
  onChange: (patch: Record<string, any>) => void;
  onToggleFeatured: (type: FeaturedType, id: string) => void;
  onSaveFeaturedTitle: (title: string) => void;
  onReset: () => void;
};

const TYPE_LABELS: Record<FeaturedType, string> = {
  market: 'المنتجات',
  service: 'الخدمات',
  question: 'الاستفسارات',
  request: 'الطلبات',
};

function initials(name: string) {
  return (name || 'ح').trim().slice(0, 1).toUpperCase();
}

export function ProfileDesignStudio({
  userId,
  profile,
  customization,
  displayName,
  stats,
  coverUri,
  coverVisible,
  coverBusy,
  items,
  featured,
  featuredBusy,
  wide,
  onPickCover,
  onRemoveCover,
  onChange,
  onToggleFeatured,
  onSaveFeaturedTitle,
  onReset,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors),[colors]);
  const accent = String(customization?.accent_color || OASIS.colors.primary);
  const banner = String(customization?.banner_style || 'emerald');
  const sectionVisibility = normalizeSectionVisibility(customization?.section_visibility);
  const showStats = customization?.show_stats !== false;
  const showBadges = customization?.show_badges !== false;
  const [featuredTitle, setFeaturedTitle] = useState(String(customization?.featured_title || DEFAULT_FEATURED_TITLE));
  const [activeType, setActiveType] = useState<FeaturedType>('market');
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setFeaturedTitle(String(customization?.featured_title || DEFAULT_FEATURED_TITLE));
  }, [customization?.featured_title]);

  const pinned = new Set(featured.map((row) => `${row.item_type}:${row.item_id}`));
  const filteredItems = items.filter((item) => item.type === activeType);
  const counts: Record<FeaturedType, number> = { market: 0, service: 0, question: 0, request: 0 };
  for (const item of items) counts[item.type] += 1;

  const toggleSection = (key: ProfileSectionKey) => {
    onChange({ section_visibility: { ...sectionVisibility, [key]: !sectionVisibility[key] } });
  };

  useEffect(() => { setCoverFailed(false); }, [coverUri]);

  const featuredCount = featured.length;

  return (
    <View style={styles.stack}>
      <View style={[styles.studioGrid, wide && styles.studioGridWide]}>
        {/* Preview column */}
        <View style={[styles.previewCol, wide && styles.previewColWide]}>
          <View style={{borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface}}>
            <LinearGradient colors={bannerColors(banner)} style={{height:120}}>
              {coverUri && coverVisible && !coverFailed && <Image source={{uri:coverUri}} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setCoverFailed(true)} />}
            </LinearGradient>
            <View style={{padding:16,alignItems:'flex-end',gap:7}}>
              <View style={{width:76,height:76,borderRadius:38,borderWidth:4,borderColor:colors.surface,marginTop:-54,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}>
                {profile?.avatar_url ? <Image source={{uri:profile.avatar_url}} style={{width:68,height:68,borderRadius:34}}/> : <Text style={{fontSize:28,color:accent,fontWeight:'800'}}>{initials(displayName)}</Text>}
              </View>
              <View style={{flexDirection:'row-reverse',alignItems:'center',gap:6}}><Text style={{color:colors.ink,fontWeight:'800',fontSize:21,textAlign:'right'}}>{displayName || 'حساب حيّنا'}</Text>{showBadges && <AccountStatusMark role={profile?.role} accountType={profile?.account_type} isVerified={Boolean(profile?.is_verified)}/>}</View>
              <Text style={{color:colors.muted,writingDirection:'ltr'}}>@{profile?.username || 'user'}</Text>
              {sectionVisibility.bio && !!profile?.bio && <Text style={{color:colors.ink,textAlign:'right',lineHeight:22}}>{profile.bio}</Text>}
              <Text style={{color:colors.muted,textAlign:'right',fontSize:12}}>{[profile?.district && 'حي ' + profile.district,profile?.city].filter(Boolean).join('، ')}</Text>
              {showStats && <Text style={{color:colors.muted,fontSize:12}}>{stats.followers} متابع · {stats.following} يتابع · {stats.content} مساهمة</Text>}
              <View style={{flexDirection:'row-reverse',gap:20,marginTop:12}}>{SECTION_META.filter(section => section.key !== 'bio' && section.key !== 'achievements' && sectionVisibility[section.key]).slice(0,3).map((section,index) => <Text key={section.key} style={{fontSize:11,color:index===0 ? accent : colors.muted,borderBottomWidth:index===0 ? 3 : 0,borderBottomColor:accent,paddingBottom:10}}>{section.label}</Text>)}</View>
            </View>
          </View>

          <View style={styles.coverActions}>
            <Pressable style={styles.coverPrimary} onPress={onPickCover} disabled={coverBusy}>
              {coverBusy ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Camera size={16} color={OASIS.colors.surface} />}
              <Text style={styles.coverPrimaryText}>{coverVisible ? 'تغيير صورة الغلاف' : 'إضافة صورة الغلاف'}</Text>
            </Pressable>
            {coverVisible ? (
              <Pressable style={styles.coverSecondary} onPress={onRemoveCover} disabled={coverBusy}>
                <Trash2 size={15} color={OASIS.colors.danger} />
                <Text style={styles.coverSecondaryText}>إزالة</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.coverHint}>
            {coverVisible
              ? 'تظهر الصورة كخلفية للملف العام. تغييرها يُحدّث الملف فورًا.'
              : 'أضف صورة لتكون خلفية ملفك. ستظهر للجميع في ملفك العام.'}
          </Text>
        </View>

        {/* Controls column */}
        <View style={styles.controlsCol}>
          <Text style={styles.fieldLabel}>لون التمييز</Text>
          <View style={styles.accentGrid}>
            {PROFILE_ACCENTS.map((accentItem) => {
              const active = accent === accentItem.value;
              return (
                <Pressable
                  accessibilityRole="radio" accessibilityState={{checked:active}}
                  key={accentItem.value}
                  style={styles.accentCell}
                  onPress={() => onChange({ accent_color: accentItem.value })}
                  accessibilityLabel={accentItem.label}
                >
                  <View style={[styles.accentDot, { backgroundColor: accentItem.value }, active && styles.accentDotActive, active && { borderColor: accentItem.value }]}>
                    {active ? <Check size={14} color="#FFFFFF" /> : null}
                  </View>
                  <Text style={[styles.accentLabel, active && { color: accentItem.value, fontWeight: '800' }]}>{accentItem.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>خلفية الملف</Text>
          <View style={styles.bannerGrid}>
            {PROFILE_BANNERS.map((bannerItem) => {
              const active = banner === bannerItem.id;
              return (
                <Pressable
                  accessibilityRole="radio" accessibilityState={{checked:active}}
                  key={bannerItem.id}
                  style={[styles.bannerTile, active && styles.bannerTileActive, active && { borderColor: accent }]}
                  onPress={() => onChange({ banner_style: bannerItem.id })}
                >
                  <LinearGradient colors={bannerItem.colors} style={StyleSheet.absoluteFillObject} />
                  <View style={styles.bannerOverlay} />
                  <Text style={styles.bannerLabel}>{bannerItem.label}</Text>
                  {active ? (
                    <View style={styles.bannerCheck}>
                      <Check size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>الأقسام الظاهرة في الملف</Text>
          <View style={styles.sectionGrid}>
            {SECTION_META.map((item) => {
              const active = sectionVisibility[item.key];
              return (
                <Pressable
                  accessibilityRole="checkbox" accessibilityState={{checked:active}}
                  key={item.key}
                  style={[styles.sectionChip, active && styles.sectionChipActive, active && { borderColor: accent, backgroundColor: accentSoft(accent, '14') }]}
                  onPress={() => toggleSection(item.key)}
                >
                  {active ? <Eye size={13} color={accent} /> : <EyeOff size={13} color={OASIS.colors.muted} />}
                  <Text style={[styles.sectionChipText, active && { color: accent, fontWeight: '800' }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.toggleGrid}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>إظهار الإحصائيات</Text>
                <Text style={styles.toggleSub}>المتابعون والإسهامات والسمعة</Text>
              </View>
              <Switch
                accessibilityLabel="إظهار الإحصائيات"
                value={showStats}
                onValueChange={(value) => onChange({ show_stats: value })}
                trackColor={{ false: OASIS.colors.line, true: accentSoft(accent, 'AA') }}
                thumbColor={showStats ? accent : '#94A3B8'}
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>إظهار الشارات</Text>
                <Text style={styles.toggleSub}>الشارات والإنجازات في الملف العام</Text>
              </View>
              <Switch
                accessibilityLabel="إظهار الشارات"
                value={showBadges}
                onValueChange={(value) => onChange({ show_badges: value })}
                trackColor={{ false: OASIS.colors.line, true: accentSoft(accent, 'AA') }}
                thumbColor={showBadges ? accent : '#94A3B8'}
              />
            </View>
          </View>

          <View style={styles.featuredTitleRow}>
            <Text style={styles.fieldLabel}>عنوان "الأعمال المميزة"</Text>
            <View style={styles.featuredTitleInputRow}>
              <TextInput
                value={featuredTitle}
                onChangeText={setFeaturedTitle}
                placeholder={DEFAULT_FEATURED_TITLE}
                placeholderTextColor="#94A3B8"
                textAlign="right"
                style={styles.featuredTitleInput}
              />
              <Pressable
                style={styles.featuredTitleSave}
                onPress={() => onSaveFeaturedTitle(featuredTitle.trim() || DEFAULT_FEATURED_TITLE)}
              >
                <Check size={15} color={OASIS.colors.surface} />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.resetButton} onPress={onReset}>
            <RotateCcw size={15} color={OASIS.colors.muted} />
            <Text style={styles.resetText}>استعادة الافتراضي</Text>
          </Pressable>
        </View>
      </View>

      {/* Featured items manager */}
      <View style={styles.featuredCard}>
        <View style={styles.featuredHeader}>
          <View style={styles.featuredHeaderCopy}>
            <Text style={styles.sectionTitle}>الأعمال المميزة</Text>
            <Text style={styles.sectionSub}>ثبّت حتى {MAX_FEATURED} عناصر لتظهر في ملفك العام ({featuredCount}/{MAX_FEATURED})</Text>
          </View>
          <Pin size={20} color={accent} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeTabs}>
          {(Object.keys(TYPE_LABELS) as FeaturedType[]).map((type) => {
            const active = activeType === type;
            return (
              <Pressable
                key={type}
                style={[styles.typeTab, active && styles.typeTabActive, active && { backgroundColor: accent }]}
                onPress={() => setActiveType(type)}
              >
                <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>
                  {TYPE_LABELS[type]} · {counts[type]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {featuredCount > 0 ? (
          <View style={styles.pinnedRow}>
            <Text style={styles.pinnedLabel}>المثبّتة:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedChips}>
              {featured.map((row) => (
                <Pressable
                  key={`${row.item_type}:${row.item_id}`}
                  style={[styles.pinnedChip, { borderColor: accent }]}
                  disabled={featuredBusy}
                  onPress={() => onToggleFeatured(row.item_type, row.item_id)}
                >
                  <Text style={[styles.pinnedChipText, { color: accent }]} numberOfLines={1}>
                    {items.find((it) => it.type === row.item_type && it.id === row.item_id)?.title || 'عنصر'}
                  </Text>
                  <Trash2 size={11} color={accent} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {filteredItems.length ? (
          <View style={styles.featuredList}>
            {filteredItems.map((item) => {
              const isPinned = pinned.has(`${item.type}:${item.id}`);
              return (
                <Pressable
                  key={`${item.type}:${item.id}`}
                  style={[styles.featuredRow, isPinned && { borderColor: accent, backgroundColor: accentSoft(accent, '0D') }]}
                  onPress={() => onToggleFeatured(item.type, item.id)}
                >
                  <View style={styles.featuredThumb}>
                    {item.image ? <Image source={{ uri: item.image }} style={styles.featuredThumbImage} /> : <Sparkles size={16} color={accent} />}
                  </View>
                  <View style={styles.featuredCopy}>
                    <Text style={styles.featuredTitle} numberOfLines={1}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.featuredSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                  </View>
                  <View style={[styles.featuredPin, isPinned && { backgroundColor: accent }]}>
                    {isPinned ? <Check size={13} color="#FFFFFF" /> : <Plus size={13} color={accent} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Sparkles size={22} color="#94A3B8" />
            <Text style={styles.emptyTitle}>لا توجد عناصر في هذا القسم</Text>
            <Text style={styles.emptySub}>أضف منتجات أو خدمات أو استفسارات لتتمكن من تثبيتها هنا.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  stack: { gap: 12 },
  studioGrid: { gap: 12 },
  studioGridWide: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  previewCol: { gap: 10 },
  previewColWide: { width: 300, flexShrink: 0 },
  previewCard: { minHeight: 220, borderRadius: 18, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: colors.line },
  previewBody: { flex: 1, justifyContent: 'space-between' },
  previewTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  previewAvatarRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  previewAvatar: { width: '100%', height: '100%' },
  previewAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewAvatarLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  previewCopy: { flex: 1, alignItems: 'flex-end' },
  previewName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  previewHandle: { color: 'rgba(255,255,255,0.82)', fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  previewLocationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 },
  previewLocation: { color: 'rgba(255,255,255,0.78)', fontSize: 10.5, fontWeight: '700' },
  previewChips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  previewChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  previewChipText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' },
  previewStats: { flexDirection: 'row-reverse', gap: 6, marginTop: 12 },
  previewStat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  previewStatValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  previewStatLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  coverActions: { flexDirection: 'row-reverse', gap: 8 },
  coverPrimary: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverPrimaryText: { color: colors.surface, fontSize: 11.5, fontWeight: '800' },
  coverSecondary: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.dangerSoft, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverSecondaryText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  coverHint: { color: colors.muted, fontSize: 10.5, textAlign: 'right', lineHeight: 16 },
  controlsCol: { flex: 1, gap: 12, minWidth: 0 },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'right', marginBottom: 2 },
  accentGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  accentCell: { width: 62, alignItems: 'center', gap: 4 },
  accentDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  accentDotActive: { borderWidth: 3 },
  accentLabel: { color: colors.muted, fontSize: 9.5, fontWeight: '700', textAlign: 'center' },
  bannerGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  bannerTile: { width: '47%', height: 58, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  bannerTileActive: { borderWidth: 2 },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  bannerLabel: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800', zIndex: 2 },
  bannerCheck: { position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  sectionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  sectionChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background },
  sectionChipActive: { borderWidth: 1.5 },
  sectionChipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  toggleGrid: { gap: 2 },
  toggleRow: { minHeight: 50, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 4 },
  toggleCopy: { flex: 1, alignItems: 'flex-end' },
  toggleTitle: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
  toggleSub: { color: colors.muted, fontSize: 10.5, marginTop: 2, textAlign: 'right' },
  featuredTitleRow: { gap: 6 },
  featuredTitleInputRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  featuredTitleInput: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, borderRadius: 11, paddingHorizontal: 11, color: colors.ink, fontSize: 12, fontWeight: '700' },
  featuredTitleSave: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  resetButton: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line },
  resetText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  featuredCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  featuredHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  featuredHeaderCopy: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  sectionSub: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', marginTop: 2 },
  typeTabs: { flexDirection: 'row-reverse', gap: 6, paddingVertical: 2 },
  typeTab: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#F1F5F9' },
  typeTabActive: { backgroundColor: colors.primary },
  typeTabText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  typeTabTextActive: { color: colors.surface },
  pinnedRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  pinnedLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  pinnedChips: { flexDirection: 'row-reverse', gap: 6 },
  pinnedChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1, backgroundColor: colors.background },
  pinnedChipText: { fontSize: 10.5, fontWeight: '700', maxWidth: 110 },
  featuredList: { gap: 7 },
  featuredRow: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, backgroundColor: colors.background },
  featuredThumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  featuredThumbImage: { width: '100%', height: '100%' },
  featuredCopy: { flex: 1, alignItems: 'flex-end' },
  featuredTitle: { color: colors.ink, fontSize: 11.5, fontWeight: '700', textAlign: 'right' },
  featuredSub: { color: colors.muted, fontSize: 10.5, marginTop: 2, textAlign: 'right' },
  featuredPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  emptyTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 11, textAlign: 'center', lineHeight: 18 },
});
