import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, MoreHorizontal, BellOff, UserX, Lock, MessageCircle } from 'lucide-react-native';
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
  return (
    <>
      <LinearGradient
        colors={['#064e3b', '#065f46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.inner}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={onBackPress}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="رجوع للرسائل"
            >
              <ChevronRight size={22} color="#ffffff" />
            </Pressable>

            <Pressable style={styles.headerUser} onPress={onUserPress}>
              {otherUser?.avatar_url && !isAnonymous ? (
                <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar as any} />
              ) : (
                <View style={styles.headerAvatarFallback}>
                  <Text style={styles.headerAvatarLetter}>{otherName[0] || 'ج'}</Text>
                </View>
              )}
              <View style={styles.headerInfo}>
                <View style={styles.headerNameRow}>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {otherName}
                  </Text>
                  {isMuted && <BellOff size={13} color="#fde68a" />}
                </View>
                {otherUser?.city && !isAnonymous ? (
                  <Text style={styles.headerCity}>
                    {otherUser.city}
                    {otherUser.district ? ' · ' + otherUser.district : ''}
                  </Text>
                ) : null}
              </View>
            </Pressable>

            <Pressable
              style={styles.headerActionBtn}
              onPress={onOptionsPress}
              accessibilityRole="button"
              accessibilityLabel="خيارات المحادثة"
            >
              <MoreHorizontal size={19} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.headerStatusRow}>
            <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
            <Text style={styles.headerStatusText}>
              {otherTyping ? 'يكتب الآن...' : isOnline ? 'متصل الآن' : 'غير متصل'}
            </Text>
            {otherTyping && <MessageCircle size={12} color="#a7f3d0" />}
          </View>
        </View>
      </LinearGradient>

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
