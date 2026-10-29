import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  MoreHorizontal,
  BellOff,
  UserX,
  Lock,
} from 'lucide-react-native';
import { OASIS } from '@/lib/oasis';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { AppHeader, HeaderAction } from '@/components/shared/AppHeader';
import { chatStyles as styles } from './chatStyles';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export type ChatUser = {
  id?: string;
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
  city?: string | null;
  district?: string | null;
  bio?: string | null;
};

export interface ChatHeaderProps {
  otherUser: ChatUser | null | undefined;
  otherName: string;
  isAnonymous: boolean;
  isMuted: boolean;
  isOnline: boolean;
  otherTyping: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
  fallbackRoute?: string;
  onBackPress: () => void;
  onUserPress: () => void;
  onOptionsPress: () => void;
  onUnblockPress: () => void;
}

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

const WARNING_TEXT = '#b45309';

function buildLocationSubtitle(user: ChatUser | null | undefined): string {
  if (!user) return '';
  const district = user.district?.trim();
  const city = user.city?.trim();
  if (district) return `حي ${district}${city ? ` · ${city}` : ''}`;
  return city ?? '';
}

function buildPresenceSubtitle(
  typing: boolean,
  online: boolean,
  locationSubtitle: string,
): string {
  if (typing) return 'يكتب الآن…';
  if (online) return 'متصل الآن';
  return locationSubtitle || 'غير متصل';
}

/* -------------------------------------------------------------------------- */
/*                              Component                                     */
/* -------------------------------------------------------------------------- */

function ChatHeaderBase({
  otherUser,
  otherName,
  isAnonymous,
  isMuted,
  isOnline,
  otherTyping,
  blockedByMe,
  blockedMe,
  fallbackRoute = '/messages',
  onBackPress,
  onUserPress,
  onOptionsPress,
  onUnblockPress,
}: ChatHeaderProps) {
  const locationSubtitle = useMemo(
    () => buildLocationSubtitle(otherUser),
    [otherUser],
  );

  const presence = useMemo(
    () => buildPresenceSubtitle(otherTyping, isOnline, locationSubtitle),
    [otherTyping, isOnline, locationSubtitle],
  );

  const avatarUrl = isAnonymous ? null : otherUser?.avatar_url ?? null;

  const showBlockedByMe = blockedByMe;
  const showBlockedMe = !blockedByMe && blockedMe;
  const showMuted = !blockedByMe && !blockedMe && isMuted;

  return (
    <>
      <AppHeader
        variant="chat"
        title={otherName}
        subtitle={presence}
        avatarUrl={avatarUrl}
        isOnline={isOnline}
        fallbackRoute={fallbackRoute}
        onBackPress={onBackPress}
        onTitlePress={onUserPress}
        rightAction={
          <HeaderAction
            accessibilityLabel="خيارات المحادثة"
            accessibilityHint="يفتح قائمة الخيارات"
            onPress={onOptionsPress}
          >
            <MoreHorizontal size={20} color={OASIS.colors.primary} />
          </HeaderAction>
        }
      />

      {showBlockedByMe ? (
        <View
          style={styles.noticeBlocked}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <UserX size={16} color={OASIS.colors.danger} />
          <Text style={styles.noticeBlockedText} numberOfLines={3}>
            أنت حظرت {otherName} — الإرسال مغلق ورسائله مخفية عنك.
          </Text>
          <Pressable
            oasisKind="action"
            onPress={onUnblockPress}
            style={styles.unblockQuickBtn}
            accessibilityRole="button"
            accessibilityLabel="إلغاء الحظر"
            accessibilityHint="يفتح المحادثة مرة أخرى"
          >
            <Text style={styles.unblockQuickText}>إلغاء الحظر</Text>
          </Pressable>
        </View>
      ) : showBlockedMe ? (
        <View
          style={styles.noticeBlocked}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Lock size={16} color={OASIS.colors.danger} />
          <Text style={styles.noticeBlockedText} numberOfLines={3}>
            {otherName} حظرك — لا يمكنكما تبادل الرسائل.
          </Text>
        </View>
      ) : showMuted ? (
        <View style={styles.noticeMuted} accessibilityRole="text">
          <BellOff size={14} color={WARNING_TEXT} />
          <Text style={styles.noticeMutedText} numberOfLines={2}>
            إشعارات هذه المحادثة مكتومة 🔕
          </Text>
        </View>
      ) : null}
    </>
  );
}

export const ChatHeader = memo(ChatHeaderBase);
export default ChatHeader;