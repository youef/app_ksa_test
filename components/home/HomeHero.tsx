import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronDown, MapPin, Mic, Search, ShieldCheck, X } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile } from '@/lib/homeUtils';

type Props = {
  profile: Profile | null;
  logoUri: string;
  greeting: string;
  unreadCount: number;
  city: string;
  district: string;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onOpenLocation: () => void;
};

export default function HomeHero({
  profile, logoUri, greeting, unreadCount, city, district,
  searchQuery, onSearchChange, onOpenLocation,
}: Props) {
  const locationLabel =
    city === 'كل المدن'
      ? 'كل مناطق المملكة'
      : `${city}${district !== 'كل الأحياء' ? ` · حي ${district}` : ''}`;

  return (
    <LinearGradient
      colors={['#065f46', '#059669', '#10b981']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.topNavRow}>
        <View style={styles.leftActions}>
          <Pressable
            onPress={() => router.push('/profile')}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="الملف الشخصي"
          >
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
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.iconCircleBtn}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
          >
            <Bell size={20} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.brandAndLocation}>
          <View style={styles.brandTitleRow}>
            <Image source={{ uri: logoUri }} style={styles.headerLogo} resizeMode="contain" />
          </View>
          <Pressable
            style={styles.locationSelectorPill}
            onPress={onOpenLocation}
            accessibilityRole="button"
            accessibilityLabel={`الموقع الحالي ${locationLabel}، اضغط للتغيير`}
          >
            <ChevronDown size={14} color="#a7f3d0" />
            <Text style={styles.locationSelectorText} numberOfLines={1}>{locationLabel}</Text>
            <MapPin size={13} color="#6ee7b7" />
          </Pressable>
        </View>
      </View>

      <Text style={styles.heroGreeting} numberOfLines={1}>
        {greeting}{profile?.display_name ? `، ${profile.display_name}` : ''}
      </Text>

      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            placeholder="ابحث عن استفسار أو طلب أو اسم جار..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            accessibilityLabel="البحث في الاستفسارات والطلبات وأسماء الجيران"
            value={searchQuery}
            onChangeText={onSearchChange}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => onSearchChange('')}
              style={styles.clearSearchBtn}
              accessibilityRole="button"
              accessibilityLabel="مسح البحث"
            >
              <X size={17} color="#64748b" />
            </Pressable>
          ) : (
            <Pressable
              style={styles.micBtn}
              onPress={() => router.push('/questions')}
              accessibilityRole="button"
              accessibilityLabel="كل الاستفسارات"
            >
              <Mic size={17} color="#059669" />
            </Pressable>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}
