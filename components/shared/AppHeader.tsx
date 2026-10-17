import type { ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  ChevronRight,
  Bell,
  Bookmark,
  MapPin,
  ChevronDown,
  ShieldCheck,
  LogIn,
} from 'lucide-react-native';
import { FALLBACK_LOGO_URI } from '@/lib/branding';
import { usePlatformConfig } from '@/lib/platformConfig';

export const APP_HEADER_HEIGHT = 52;

export interface AppHeaderProps {
  variant?: 'home' | 'tab' | 'sub' | 'chat';
  title?: string;
  subtitle?: string;
  fallbackRoute?: string;
  rightAction?: ReactNode;

  // Home variant props
  city?: string;
  district?: string;
  onOpenLocation?: () => void;
  showLocation?: boolean;
  profile?: any;
  isGuest?: boolean;
  unreadCount?: number;
  logoUri?: string;

  // Chat variant props
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export function AppHeader({
  variant = 'sub',
  title,
  subtitle,
  fallbackRoute = '/home',
  rightAction,
  city = 'كل المدن',
  district,
  onOpenLocation,
  showLocation = true,
  profile,
  isGuest = false,
  unreadCount = 0,
  logoUri,
  avatarUrl,
  isOnline,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { branding } = usePlatformConfig();
  const headerKey = title?.includes('بحث') ? 'search' : title?.includes('سوق') ? 'market' : title?.includes('يوميات') || title?.includes('قصص') ? 'stories' : undefined;
  const displayTitle = (headerKey && branding.headers?.[headerKey]) || title;
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 24 : 0);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as never);
    }
  };

  const locationDisplay =
    district && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة'
      ? `${city} · حي ${district}`
      : city || 'كل المملكة';

  const renderContent = () => {
    // 1. HOME VARIANT
    if (variant === 'home') {
      return (
        <View style={styles.content}>
          {/* Right side in RTL: Avatar / User greeting or Login */}
          <View style={styles.sideGroup}>
            {isGuest ? (
              <Pressable
                onPress={() => router.push('/auth')}
                style={styles.pillButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="تسجيل الدخول"
              >
                <LogIn size={15} color="#059669" />
                <Text style={styles.pillText}>دخول</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/profile')}
                style={styles.avatarButton}
                hitSlop={8}
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
                    <View style={styles.verifiedBadge}>
                      <ShieldCheck size={9} color="#fff" />
                    </View>
                  )}
                </View>
              </Pressable>
            )}
          </View>

          {showLocation && (
            <>
              {/* Center: Location Pill (City & District) */}
              <Pressable
                onPress={onOpenLocation}
                style={styles.locationPill}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="تغيير الحي والموقع"
              >
                <MapPin size={14} color="#059669" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationDisplay}
                </Text>
                <ChevronDown size={14} color="#64748b" />
              </Pressable>
            </>
          )}

          {/* Left side in RTL: Notifications & Brand Logo */}
          <View style={styles.sideGroup}>
            {!isGuest && (
              <>
                <Pressable
                  onPress={() => router.push('/notifications')}
                  style={styles.iconCircle}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="الإشعارات"
                >
                  <Bell size={18} color="#334155" />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => router.push('/favorites')}
                  style={styles.iconCircle}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="المفضلة"
                >
                  <Bookmark size={17} color="#334155" />
                </Pressable>
              </>
            )}
            <Pressable
              onPress={() => router.push('/home')}
              style={styles.logoWrap}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="حيّنا"
            >
              <Image source={{ uri: logoUri || FALLBACK_LOGO_URI }} style={styles.logoImg} />
            </Pressable>
          </View>
        </View>
      );
    }

    // 2. TAB VARIANT (Market, Search, Messages, More)
    if (variant === 'tab') {
      return (
        <View style={styles.content}>
          <View style={styles.titleArea}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {displayTitle}
            </Text>
            {subtitle ? (
              <Text style={styles.pageSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {rightAction ? (
            <View style={styles.actionSlot}>{rightAction}</View>
          ) : (
            <View style={styles.actionSpacer} />
          )}
        </View>
      );
    }

    // 3. CHAT VARIANT
    if (variant === 'chat') {
      return (
        <View style={styles.content}>
          <Pressable
            onPress={goBack}
            style={styles.iconCircle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <ChevronRight size={22} color="#0f172a" />
          </Pressable>

          <View style={styles.chatInfoWrap}>
            <View style={styles.chatAvatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.chatAvatar} />
              ) : (
                <View style={styles.chatAvatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{title?.[0] || '💬'}</Text>
                </View>
              )}
              {isOnline && <View style={styles.onlineDot} />}
            </View>
            <View style={styles.chatTextWrap}>
              <Text style={styles.pageTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              {subtitle ? (
                <Text style={styles.chatStatusText} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          {rightAction ? (
            <View style={styles.actionSlot}>{rightAction}</View>
          ) : (
            <View style={styles.actionSpacer} />
          )}
        </View>
      );
    }

    // 4. SUB-PAGE VARIANT (Default for detail/action pages)
    return (
      <View style={styles.content}>
        <Pressable
          onPress={goBack}
          style={styles.iconCircle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <ChevronRight size={22} color="#0f172a" />
        </Pressable>

        <View style={styles.centerTitleArea}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {displayTitle || branding.name || 'حيّنا'}
          </Text>
          {subtitle ? (
            <Text style={styles.pageSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightAction ? (
          <View style={styles.actionSlot}>{rightAction}</View>
        ) : (
          <View style={styles.actionSpacer} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 24 : 0} tint="light" style={styles.surface}>
        {renderContent()}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.85)',
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  surface: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  content: {
    height: APP_HEADER_HEIGHT,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    gap: 8,
  },
  sideGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  pillButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  avatarButton: {
    padding: 2,
  },
  avatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    position: 'relative',
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -1,
    left: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPill: {
    flex: 1,
    maxWidth: 210,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    maxWidth: 155,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  logoWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  logoImg: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  titleArea: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  centerTitleArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
    textAlign: 'center',
  },
  actionSlot: {
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionSpacer: {
    width: 36,
    height: 36,
  },
  chatInfoWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  chatAvatarWrap: {
    width: 34,
    height: 34,
    position: 'relative',
  },
  chatAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  chatAvatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatTextWrap: {
    flex: 1,
    alignItems: 'flex-start',
  },
  chatStatusText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#10b981',
  },
});

export default AppHeader;
