import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, LogIn, ShieldCheck, MapPin, ChevronDown, Search, X } from 'lucide-react-native';
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

export default function HomeHero({
  profile, logoUri, greeting, unreadCount,
  city = 'الرياض',
  district,
  searchQuery = '',
  onSearchChange,
  onOpenLocation,
  isGuest,
}: Props) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [logoUri]);

  const locationDisplay = district && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة'
    ? `${city} · حي ${district}`
    : city || 'المملكة العربية السعودية';

  return (
    <LinearGradient
      colors={[OASIS.colors.deep, OASIS.colors.deep, OASIS.colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.topNavRow}>
        {/* Right side (in RTL): User avatar and greeting */}
        <View style={styles.heroUserSection}>
          {isGuest ? (
            <Pressable oasisKind="chip"
              onPress={() => router.push('/auth')}
              style={styles.loginPill}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
            >
              <LogIn size={16} color={OASIS.colors.soft} />
              <View style={styles.greetingTextCol}>
                <Text style={styles.heroGreetingSmall}>تصفح كزائر</Text>
                <Text style={styles.heroGreetingBold}>تسجيل الدخول</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable oasisKind="action"
              onPress={() => router.push('/profile')}
              style={styles.userProfileBtn}
              accessibilityRole="button"
              accessibilityLabel="الملف الشخصي"
            >
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
                  </View>
                )}
                {profile?.is_geoverified && (
                  <View style={styles.avatarVerifiedBadge}>
                    <ShieldCheck size={10} color={OASIS.colors.surface} />
                  </View>
                )}
              </View>
              <View style={styles.greetingTextCol}>
                <Text style={styles.heroGreetingSmall}>{greeting || 'أهلاً بك'} 👋</Text>
                <Text style={styles.heroGreetingBold} numberOfLines={1}>
                  {profile?.display_name || 'يا جارنا'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Left side (in RTL): Notification Bell & Platform Logo */}
        <View style={styles.heroBrandSection}>
          {!isGuest && (
            <Pressable oasisKind="action"
              onPress={() => (isGuest ? requireAccount() : router.push('/notifications'))}
              style={styles.iconCircleBtn}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
            >
              <Bell size={19} color={OASIS.colors.soft} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={() => router.push('/home')}
            style={styles.brandLogoWrap}
            accessibilityRole="button"
            accessibilityLabel="حيّنا الصفحة الرئيسية"
          >
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandNameText}>حيّنا</Text>
              <Text style={styles.brandSubText}>مجتمع الجيران</Text>
            </View>
            <Image
              source={{ uri: imgError ? FALLBACK_LOGO_URI : logoUri }}
              style={styles.headerLogo}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
          </Pressable>
        </View>
      </View>

      {/* Location Selector Pill */}
      {onOpenLocation && (
        <View style={{ marginTop: 12, marginBottom: 8, paddingHorizontal: 4 }}>
          <Pressable
            onPress={onOpenLocation}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.22)',
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 8,
              gap: 8,
            }}
          >
            <MapPin size={16} color="#6ee7b7" />
            <Text style={{ flex: 1, color: OASIS.colors.surface, fontSize: 13, fontWeight: '600', textAlign: 'right' }} numberOfLines={1}>
              {locationDisplay}
            </Text>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#a7f3d0', fontSize: 11, fontWeight: '700' }}>تغيير الحي</Text>
              <ChevronDown size={14} color="#a7f3d0" />
            </View>
          </Pressable>
        </View>
      )}

      {/* Fast In-Feed Search Input */}
      {onSearchChange && (
        <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            backgroundColor: OASIS.colors.surface,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 46,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0,
            shadowRadius: 6,
            elevation: 2,
            gap: 8,
          }}>
            <Search size={18} color={OASIS.colors.primary} />
            <TextInput
              style={{
                flex: 1,
                fontSize: 13,
                color: OASIS.colors.ink,
                textAlign: 'right',
                height: 40,
                padding: 0,
              }}
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="ابحث عن سؤال، أداة، أو فزعة في حيك..."
              placeholderTextColor="#94a3b8"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => onSearchChange('')} style={{ padding: 4 }}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </LinearGradient>
  );
}
