import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, ChevronDown, LogIn, Map, MapPin, Mic, Search, ShieldCheck, X } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile } from '@/lib/homeUtils';
import { requireAccount } from '@/lib/authGate';

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
  isGuest: boolean;
};

export default function HomeHero({
  profile, logoUri, greeting, unreadCount, city, district,
  searchQuery, onSearchChange, onOpenLocation, isGuest,
}: Props) {
  const locationLabel =
    city === 'كل المدن'
      ? 'كل مناطق المملكة'
      : `${city}${district !== 'كل الأحياء' ? ` · حي ${district}` : ''}`;

  return (
    <View style={styles.hero}>
      <View style={styles.topNavRow}>
        <View style={styles.leftActions}>
          {isGuest ? (
            <Pressable onPress={() => router.push('/auth')} style={[styles.iconCircleBtn, { flexDirection: 'row', width: 'auto', paddingHorizontal: 12, gap: 6 }]} accessibilityRole="button">
              <LogIn size={17} color="#d1fae5" />
              <Text style={{ color: '#ecfdf5', fontSize: 12, fontWeight: '800' }}>دخول</Text>
            </Pressable>
          ) : <Pressable
            onPress={() => router.push('/profile')}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="الملف الشخصي"
          >
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} /> : (
              <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text></View>
            )}
            {profile?.is_geoverified && <View style={styles.avatarVerifiedBadge}><ShieldCheck size={10} color="#fff" /></View>}
          </Pressable>}

          <Pressable
            onPress={() => router.push('/map')}
            style={styles.iconCircleBtn}
            accessibilityRole="button"
            accessibilityLabel="الخريطة"
          >
            <Map size={20} color="#d1fae5" />
          </Pressable>

          {!isGuest && <Pressable
            onPress={() => isGuest ? requireAccount() : router.push('/notifications')}
            style={styles.iconCircleBtn}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'}
          >
            <Bell size={20} color="#d1fae5" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>}
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
        {isGuest ? 'تصفح حيّك كزائر' : `${greeting}${profile?.display_name ? `، ${profile.display_name}` : ''}`}
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
    </View>
  );
}
