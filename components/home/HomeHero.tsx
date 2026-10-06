import { useState, useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, LogIn, ShieldCheck } from 'lucide-react-native';
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
  isGuest,
}: Props) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [logoUri]);

  return (
    <LinearGradient
      colors={['#064e3b', '#065f46', '#047857']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.topNavRow}>
        {/* Right side (in RTL): User avatar and greeting */}
        <View style={styles.heroUserSection}>
          {isGuest ? (
            <Pressable
              onPress={() => router.push('/auth')}
              style={styles.loginPill}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
            >
              <LogIn size={16} color="#d1fae5" />
              <View style={styles.greetingTextCol}>
                <Text style={styles.heroGreetingSmall}>تصفح كزائر</Text>
                <Text style={styles.heroGreetingBold}>تسجيل الدخول</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
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
                    <ShieldCheck size={10} color="#fff" />
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
            <Pressable
              onPress={() => (isGuest ? requireAccount() : router.push('/notifications'))}
              style={styles.iconCircleBtn}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
            >
              <Bell size={19} color="#d1fae5" />
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
    </LinearGradient>
  );
}
