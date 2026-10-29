import {
  OasisPressable as Pressable,
  OasisTextInput as TextInput,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  LogIn,
  ShieldCheck,
  MapPin,
  ChevronDown,
  Search,
  X,
} from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile } from '@/lib/homeUtils';
import { requireAccount } from '@/lib/authGate';
import { FALLBACK_LOGO_URI } from '@/lib/branding';

type Props = {
  profile: Profile | null;
  logoUri: string;
  greeting: string;
  unreadCount: number;
  city?: string;
  district?: string;
  searchQuery?: string;
  onSearchChange?: (v: string) => void;
  onOpenLocation?: () => void;
  isGuest: boolean;
};

const EMPTY_DISTRICTS = new Set(['كل الأحياء', 'كل أحياء المدينة']);

function HomeHeroBase({
  profile,
  logoUri,
  greeting,
  unreadCount,
  city = 'الرياض',
  district,
  searchQuery = '',
  onSearchChange,
  onOpenLocation,
  isGuest,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const searchInputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  // إعادة تعيين خطأ الصورة عند تغيير الرابط
  useEffect(() => {
    setImgError(false);
  }, [logoUri]);

  // احسب نص الموقع مرة واحدة
  const locationDisplay = useMemo(() => {
    const hasRealDistrict = !!district && !EMPTY_DISTRICTS.has(district);
    if (hasRealDistrict) return `${city} · حي ${district}`;
    return city || 'المملكة العربية السعودية';
  }, [city, district]);

  // احمِ من logoUri فارغ
  const effectiveLogoUri =
    imgError || !logoUri?.trim() ? FALLBACK_LOGO_URI : logoUri;

  const showClear = searchQuery.length > 0;

  const handleClearSearch = () => {
    onSearchChange?.('');
    searchInputRef.current?.focus();
  };

  return (
    <LinearGradient
      colors={[OASIS.colors.deep, OASIS.colors.deep, OASIS.colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.topNavRow}>
        {/* الجهة اليمنى في RTL: المستخدم أو تسجيل الدخول */}
        <View style={styles.heroUserSection}>
          {isGuest ? (
            <Pressable
              oasisKind="chip"
              onPress={() => router.push('/auth')}
              style={styles.loginPill}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
              accessibilityHint="ينقلك إلى شاشة تسجيل الدخول"
            >
              <LogIn size={16} color={OASIS.colors.soft} />
              <View style={styles.greetingTextCol}>
                <Text style={styles.heroGreetingSmall}>تصفح كزائر</Text>
                <Text style={styles.heroGreetingBold}>تسجيل الدخول</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              oasisKind="action"
              onPress={() => router.push('/profile')}
              style={styles.userProfileBtn}
              accessibilityRole="button"
              accessibilityLabel="الملف الشخصي"
            >
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={styles.avatarImg}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>
                      {profile?.display_name?.[0] || 'ح'}
                    </Text>
                  </View>
                )}
                {profile?.is_geoverified && (
                  <View style={styles.avatarVerifiedBadge}>
                    <ShieldCheck size={10} color={OASIS.colors.surface} />
                  </View>
                )}
              </View>
              <View style={styles.greetingTextCol}>
                <Text style={styles.heroGreetingSmall} numberOfLines={1}>
                  {greeting || 'أهلاً بك'} 👋
                </Text>
                <Text style={styles.heroGreetingBold} numberOfLines={1}>
                  {profile?.display_name || 'يا جارنا'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* الجهة اليسرى في RTL: الإشعارات والشعار */}
        <View style={styles.heroBrandSection}>
          {!isGuest && (
            <Pressable
              oasisKind="action"
              onPress={() => router.push('/notifications')}
              style={styles.iconCircleBtn}
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `الإشعارات، ${unreadCount} غير مقروء`
                  : 'الإشعارات'
              }
              hitSlop={6}
            >
              <Bell size={19} color={OASIS.colors.soft} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/home')}
            style={styles.brandLogoWrap}
            accessibilityRole="button"
            accessibilityLabel="حيّنا — الصفحة الرئيسية"
          >
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandNameText}>حيّنا</Text>
              <Text style={styles.brandSubText}>مجتمع الجيران</Text>
            </View>
            <Image
              source={{ uri: effectiveLogoUri }}
              style={styles.headerLogo}
              resizeMode="contain"
              onError={() => setImgError(true)}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </View>
      </View>

      {/* زر اختيار الحي */}
      {onOpenLocation && (
        <View style={styles.locationPillWrap}>
          <Pressable
            onPress={onOpenLocation}
            style={styles.locationPill}
            accessibilityRole="button"
            accessibilityLabel={`الموقع الحالي: ${locationDisplay}. اضغط لتغيير الحي`}
            accessibilityHint="يفتح اختيار المدينة والحي"
          >
            <MapPin size={16} color={OASIS.colors.primary} />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {locationDisplay}
            </Text>
            <View style={styles.locationPillCta}>
              <Text style={styles.locationPillCtaText}>تغيير الحي</Text>
              <ChevronDown size={14} color={OASIS.colors.primary} />
            </View>
          </Pressable>
        </View>
      )}

      {/* بحث سريع داخل الهيرو */}
      {onSearchChange && (
        <View style={styles.heroSearchWrap}>
          <View style={styles.heroSearchBar}>
            <Search size={18} color={OASIS.colors.primary} />
            <TextInput
              ref={searchInputRef}
              style={styles.heroSearchInput}
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="ابحث عن سؤال، أداة، أو فزعة في حيك..."
              placeholderTextColor={OASIS.colors.muted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="بحث سريع"
              accessibilityHint="ابحث عن سؤال أو أداة أو فزعة في حيّك"
            />
            {showClear && (
              <Pressable
                onPress={handleClearSearch}
                style={styles.heroSearchClearBtn}
                accessibilityRole="button"
                accessibilityLabel="مسح البحث"
                hitSlop={8}
              >
                <X size={16} color={OASIS.colors.muted} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

export default memo(HomeHeroBase);