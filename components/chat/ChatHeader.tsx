import React from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  MoreHorizontal,
  BellOff,
  UserX,
  Lock,
  User,
  ShieldCheck,
  CheckCircle2,
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
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 24 : 0);

  const locationSubtitle = otherUser?.district
    ? `حي ${otherUser.district}${otherUser.city ? ` · ${otherUser.city}` : ''}`
    : otherUser?.city || '';

  return (
    <>
      <View
        style={{
          width: '100%',
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
          paddingTop: topInset,
          paddingBottom: 8,
          zIndex: 100,
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View style={styles.inner}>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 52,
            gap: 10,
          }}>
            {/* Back Button */}
            <Pressable
              onPress={onBackPress}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: '#f8fafc',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="رجوع للرسائل"
              hitSlop={8}
            >
              <ChevronRight size={22} color="#0f172a" />
            </Pressable>

            {/* User Identity Slot */}
            <Pressable
              style={{
                flex: 1,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 10,
              }}
              onPress={onUserPress}
              accessibilityRole="button"
              accessibilityLabel="عرض الملف الشخصي"
            >
              {/* Avatar */}
              <View style={{ position: 'relative' }}>
                {otherUser?.avatar_url && !isAnonymous ? (
                  <Image
                    source={{ uri: otherUser.avatar_url }}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      borderWidth: 1.5,
                      borderColor: '#e2e8f0',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: '#ecfdf5',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: '#a7f3d0',
                    }}
                  >
                    <Text style={{ color: '#059669', fontSize: 17, fontWeight: '900' }}>
                      {(otherName?.[0] || 'ج').toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Online indicator dot */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: isOnline ? '#10b981' : '#94a3b8',
                    borderWidth: 2,
                    borderColor: '#ffffff',
                  }}
                />
              </View>

              {/* Names and Status */}
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                  <Text
                    style={{ color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' }}
                    numberOfLines={1}
                  >
                    {otherName}
                  </Text>
                  {otherUser?.is_verified && !isAnonymous && (
                    <CheckCircle2 size={13} color="#059669" />
                  )}
                  {isMuted && <BellOff size={13} color="#d97706" />}
                </View>

                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: otherTyping || isOnline ? '700' : '600',
                    color: otherTyping ? '#059669' : isOnline ? '#059669' : '#64748b',
                    textAlign: 'right',
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {otherTyping
                    ? 'يكتب الآن...'
                    : isOnline
                    ? 'متصل الآن'
                    : locationSubtitle || 'غير متصل'}
                </Text>
              </View>
            </Pressable>

            {/* Left Action Buttons */}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              {/* Profile Shortcut */}
              <Pressable
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={onUserPress}
                accessibilityRole="button"
                accessibilityLabel="الملف الشخصي"
                hitSlop={6}
              >
                <User size={16} color="#059669" />
              </Pressable>

              {/* More Options */}
              <Pressable
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={onOptionsPress}
                accessibilityRole="button"
                accessibilityLabel="خيارات المحادثة"
                hitSlop={6}
              >
                <MoreHorizontal size={18} color="#475569" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

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
