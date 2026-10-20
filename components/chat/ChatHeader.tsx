import { AppHeader, HeaderAction } from '@/components/shared/AppHeader';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  MoreHorizontal,
  BellOff,
  UserX,
  Lock,
} from 'lucide-react-native';
import { chatStyles as styles } from './chatStyles';

export interface ChatHeaderProps {
  otherUser: any;
  otherName: string;
  isAnonymous: boolean;
  isMuted: boolean;
  isOnline: boolean;
  otherTyping: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
  onBackPress: () => void;
  onUserPress: () => void;
  onOptionsPress: () => void;
  onUnblockPress: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  otherUser,
  otherName,
  isAnonymous,
  isMuted,
  isOnline,
  otherTyping,
  blockedByMe,
  blockedMe,
  onBackPress,
  onUserPress,
  onOptionsPress,
  onUnblockPress,
}) => {
  const locationSubtitle = otherUser?.district
    ? `حي ${otherUser.district}${otherUser.city ? ` · ${otherUser.city}` : ''}`
    : otherUser?.city || '';

  return (
    <>
      <AppHeader
        variant="chat"
        title={otherName}
        subtitle={otherTyping ? 'يكتب الآن…' : isOnline ? 'متصل الآن' : locationSubtitle || 'غير متصل'}
        avatarUrl={isAnonymous ? null : otherUser?.avatar_url}
        isOnline={isOnline}
        fallbackRoute="/messages"
        onBackPress={onBackPress}
        onTitlePress={onUserPress}
        rightAction={<HeaderAction accessibilityLabel="خيارات المحادثة" onPress={onOptionsPress}><MoreHorizontal size={20} color="#047857" /></HeaderAction>}
      />

      {/* Notice Banners */}
      {blockedByMe ? (
        <View style={styles.noticeBlocked}>
          <UserX size={16} color="#dc2626" />
          <Text style={styles.noticeBlockedText}>
            أنت حظرت {otherName} — الإرسال مغلق ورسائله مخفية عنك.
          </Text>
          <Pressable onPress={onUnblockPress} style={styles.unblockQuickBtn}>
            <Text style={styles.unblockQuickText}>إلغاء الحظر</Text>
          </Pressable>
        </View>
      ) : blockedMe ? (
        <View style={styles.noticeBlocked}>
          <Lock size={16} color="#dc2626" />
          <Text style={styles.noticeBlockedText}>
            {otherName} حظرك — لا يمكنكما تبادل الرسائل.
          </Text>
        </View>
      ) : isMuted ? (
        <View style={styles.noticeMuted}>
          <BellOff size={14} color="#b45309" />
          <Text style={styles.noticeMutedText}>إشعارات هذه المحادثة مكتومة 🔕</Text>
        </View>
      ) : null}
    </>
  );
};
