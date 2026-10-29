import { memo } from 'react';
import { Image, Text, View } from 'react-native';
import { chatStyles as styles } from './chatStyles';
import type { ChatUser } from './ChatHeader';

export interface EmptyChatStateProps {
  otherUser: ChatUser | null | undefined;
  otherName: string;
  isAnonymous: boolean;
  blockedByMe: boolean;
  isCleared: boolean;
}

function EmptyChatStateBase({
  otherUser,
  otherName,
  isAnonymous,
  blockedByMe,
  isCleared,
}: EmptyChatStateProps) {
  const initial = otherName?.[0] || 'ج';
  const showAvatar = !isAnonymous && Boolean(otherUser?.avatar_url);
  const showBio = !isAnonymous && Boolean(otherUser?.bio);

  const hint = blockedByMe
    ? 'المحادثة مغلقة بسبب الحظر'
    : isCleared
      ? 'ابدأ محادثة جديدة — سترى رسائلك الجديدة فقط'
      : 'ابدأ محادثتك مع جارك بالحي 👋';

  return (
    <View style={styles.emptyConv}>
      <View style={styles.emptyConvIcon}>
        {showAvatar ? (
          <Image
            source={{ uri: otherUser!.avatar_url! }}
            style={styles.emptyConvAvatar}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.emptyConvAvatarFallback}>
            <Text style={styles.emptyConvAvatarLetter}>{initial}</Text>
          </View>
        )}
      </View>

      <Text style={styles.emptyConvName} numberOfLines={1}>
        {otherName}
      </Text>

      {showBio && (
        <Text style={styles.emptyConvBio} numberOfLines={3}>
          {otherUser!.bio}
        </Text>
      )}

      <Text style={styles.emptyConvHint}>{hint}</Text>
    </View>
  );
}

export const EmptyChatState = memo(EmptyChatStateBase);
export default EmptyChatState;